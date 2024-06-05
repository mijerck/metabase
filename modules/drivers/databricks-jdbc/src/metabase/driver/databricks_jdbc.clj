(ns metabase.driver.databricks-jdbc
  (:require
   [java-time.api :as t]
   [metabase.driver :as driver]
   [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
   [metabase.driver.sql-jdbc.execute :as sql-jdbc.execute]
   [metabase.driver.sql-jdbc.sync :as sql-jdbc.sync]
   [metabase.driver.sql-jdbc.sync.describe-database :as sql-jdbc.describe-database]
   [metabase.driver.sql-jdbc.sync.interface :as sql-jdbc.sync.interface]
   [metabase.driver.sql.query-processor :as sql.qp]
   [metabase.util :as u]
   [ring.util.codec :as codec])
  (:import
   [java.sql Connection Date PreparedStatement Timestamp]
   [java.time LocalDate LocalDateTime ZonedDateTime]))

(set! *warn-on-reflection* true)

(driver/register! :databricks-jdbc, :parent :sql-jdbc)

;; TODO: Iterate over features (not limited to following) and maybe add more.
(doseq [[feature supported?] {:basic-aggregations              true
                              :binning                         true
                              :expression-aggregations         true
                              :expressions                     true
                              :native-parameters               true
                              :nested-queries                  true
                              :standard-deviation-aggregations true
                              :test/jvm-timezone-setting       false}]
  (defmethod driver/database-supports? [:databricks-jdbc feature] [_driver _feature _db] supported?))

;; TODO: Following is probably incorrect. Find out why it was added and address!
#_(defmethod sql-jdbc.execute/statement-supported? :databricks-jdbc [_] false)

(defmethod sql-jdbc.conn/connection-details->spec :databricks-jdbc
  [_driver {:keys [catalog host http-path schema token] :as _details}]
  {:classname        "com.databricks.client.jdbc.Driver"
   :subprotocol      "databricks"
   ;; TODO: urlencode strings!
   :subname          (str "//" host ":443/"
                          ;; TODO: following should be mandatory!
                          (when (string? (not-empty catalog))
                            (str ";ConnCatalog=" (codec/url-encode catalog)))
                          (when (string? (not-empty schema))
                            (str ";ConnSchema=" (codec/url-encode schema))))
   :transportMode    "http"
   :ssl              1
   :AuthMech         3
   :httpPath         http-path
   :uid              "token"
   :pwd              token
   ;; TODO: Decide whether following is necessary
   ;;       based on https://docs.databricks.com/en/integrations/jdbc/capability.html#jdbc-native.
   :UseNativeQuery 1
   ;; TODO: There's an exception on logging thrown when attempting to create a database for a first time.
   ;;       Following has no effect in that regards.
   :LogLevel 0})

(defmethod driver/describe-database :databricks-jdbc
  [driver db-or-id-or-spec]
  {:tables
   (sql-jdbc.execute/do-with-connection-with-options
    driver
    db-or-id-or-spec
    nil
    (fn [^Connection conn]
      (let [database                 (sql-jdbc.describe-database/db-or-id-or-spec->database db-or-id-or-spec)
            {:keys [catalog schema]} (:details database)
            dbmeta                   (.getMetaData conn)]
        (with-open [rs (.getTables dbmeta catalog schema nil
                                   ;; manually verified
                                   (into-array String ["TABLE" "VIEW"]))]
          (let [rs-meta (.getMetaData rs)
                col-count (.getColumnCount rs-meta)
                rows (loop [rows []]
                       (.next rs)
                       (if (.isAfterLast rs)
                         rows
                         (recur (conj rows (mapv (fn [idx]
                                                   (.getObject rs ^long idx))
                                                 (map inc (range col-count)))))))
                fields (map (fn [[_catalog schema table-name _table-type remarks]]
                              {:name table-name
                               :schema schema
                               :description remarks})
                            rows)
                ;; eg this could be execute for all fields first?
                fields* (filter (comp (partial sql-jdbc.sync.interface/have-select-privilege?
                                               :databricks-jdbc
                                               conn
                                               schema)
                                      :name)
                                fields)]
            (set fields*))))))})

;; TODO: Why is the following required?
#_(defmethod sql-jdbc.conn/data-warehouse-connection-pool-properties :databricks-jdbc
  [driver database]
  (merge
   ((get-method sql-jdbc.conn/data-warehouse-connection-pool-properties :sql-jdbc) driver database)
   {"preferredTestQuery" "SELECT 1"}))

;; TODO: Verify the types are correct!
(defmethod sql-jdbc.sync/database-type->base-type :databricks-jdbc
  [_ database-type]
  (condp re-matches (u/lower-case-en (name database-type))
    #"boolean"          :type/Boolean
    #"tinyint"          :type/Integer
    #"smallint"         :type/Integer
    #"int"              :type/Integer
    #"bigint"           :type/BigInteger
    #"float"            :type/Float
    #"double"           :type/Float
    #"double precision" :type/Double
    #"decimal.*"        :type/Decimal
    #"char.*"           :type/Text
    #"varchar.*"        :type/Text
    #"string.*"         :type/Text
    #"binary*"          :type/*
    #"date"             :type/Date
    #"time"             :type/Time
    #"timestamp"        :type/DateTime
    #"interval"         :type/*
    #"array.*"          :type/Array
    #"map"              :type/Dictionary
    #".*"               :type/*))

#_(defn- valid-describe-table-row? [{:keys [col_name data_type]}]
  (every? (every-pred (complement str/blank?)
                      (complement #(str/starts-with? % "#")))
          [col_name data_type]))

#_(defn- dash-to-underscore [s]
  (when s
    (str/replace s #"-" "_")))

;; TODO: Following probably also not necessary!
#_(defmethod driver/describe-table :databricks-jdbc
  [driver database {table-name :name, schema :schema}]
  {:name   table-name
   :schema schema
   :fields
   (with-open [conn (jdbc/get-connection (sql-jdbc.conn/db->pooled-connection-spec database))]
     (let [results (jdbc/query {:connection conn} [(format
                                                    "describe %s"
                                                    (sql.u/quote-name driver :table
                                                                      (dash-to-underscore schema)
                                                                      (dash-to-underscore table-name)))])]
       (set
        (for [[idx {col-name :col_name, data-type :data_type, :as result}] (m/indexed results)
              :while (valid-describe-table-row? result)]
          {:name              col-name
           :database-type     data-type
           :base-type         (sql-jdbc.sync/database-type->base-type :databricks-jdbc (keyword data-type))
           :database-position idx}))))})

;; TODO: Why is the following required?
#_(def ^:dynamic *param-splice-style*
  "How we should splice params into SQL (i.e. 'unprepare' the SQL). Either `:friendly` (the default) or `:paranoid`.
  `:friendly` makes a best-effort attempt to escape strings and generate SQL that is nice to look at, but should not
  be considered safe against all SQL injection -- use this for 'convert to SQL' functionality. `:paranoid` hex-encodes
  strings so SQL injection is impossible; this isn't nice to look at, so use this for actually running a query."
  :friendly)

;; TODO: Why is the following required?
;; bound variables are not supported in Spark SQL (maybe not Hive either, haven't checked)
#_(defmethod driver/execute-reducible-query :databricks-jdbc
  [driver {{sql :query, :keys [params], :as inner-query} :native, :as outer-query} context respond]
  (let [inner-query (-> (assoc inner-query
                               :remark (qp.util/query->remark :databricks-jdbc outer-query)
                               :query  (if (seq params)
                                         (binding [*param-splice-style* :paranoid]
                                           (unprepare/unprepare driver (cons sql params)))
                                         sql)
                               ;; TODO: mbql u inaccessible, resolve!
                               :max-rows 1000 #_(mbql.u/query->max-rows-limit outer-query))
                        (dissoc :params))
        query       (assoc outer-query :native inner-query)]
    ((get-method driver/execute-reducible-query :sql-jdbc) driver query context respond)))

;; TODO: Databricks should be able to handle setting session timezone!
#_(defmethod sql-jdbc.execute/connection-with-timezone :databricks-jdbc
  [driver database _timezone-id]
  (let [conn (.getConnection (sql-jdbc.execute/datasource-with-diagnostic-info! driver database))]
    (try
      (.setTransactionIsolation conn Connection/TRANSACTION_READ_UNCOMMITTED)
      conn
      (catch Throwable e
        (.close conn)
        (throw e)))))

;; TODO: Why is the following required?
#_(defmethod sql-jdbc.execute/prepared-statement :databricks-jdbc
  [driver ^Connection conn ^String sql params]
  (let [stmt (.prepareStatement conn sql
                                ResultSet/TYPE_FORWARD_ONLY
                                ResultSet/CONCUR_READ_ONLY)]
    (try
      (.setFetchDirection stmt ResultSet/FETCH_FORWARD)
      (sql-jdbc.execute/set-parameters! driver stmt params)
      stmt
      (catch Throwable e
        (.close stmt)
        (throw e)))))

;; TODO: Why is the following required?
#_(when-not (get (methods driver/database-supports?) [:databricks-jdbc :foreign-keys])
  (defmethod driver/database-supports? [:databricks-jdbc :foreign-keys] [_driver _feature _db] true))

(defmethod sql.qp/quote-style :databricks-jdbc
  [_driver]
  :mysql)

;; TODO: unprepare value
;; TODO: Verify following is actually the right thing to do.
(defmethod sql-jdbc.execute/set-parameter [:databricks-jdbc LocalDate]
  [_driver ^PreparedStatement ps i ^LocalDate t]
  (.setObject ps i (Date/valueOf t)))

;; TODO: unprepare value
;; TODO: Verify following is actually the right thing to do.
(defmethod sql-jdbc.execute/set-parameter [:databricks-jdbc LocalDateTime]
  [_driver ^PreparedStatement ps i ^LocalDateTime t]
  (.setObject ps i (Timestamp/valueOf t)))

;; TODO: !!!
#_(defmethod sql.qp/add-interval-honeysql-form :databricks-plain
  [driver hsql-form amount unit]
  (if (= unit :quarter)
    (recur driver hsql-form (* amount 3) :month)
    (h2x/+ (h2x/->timestamp hsql-form)
           [::interval amount unit])))

;; Following 3 implementations are necessary for data loading logic in `insert-rows-honeysql-form :sql/test-extensions`
;; to work correctly. Databricks jdbc driver is unable to execute `.setObject` with argument being instance of one of
;; those classes.
;;
;; Relevant trace:
;  [[com.databricks.client.exceptions.ExceptionConverter toSQLException nil -1]
;   [com.databricks.client.jdbc.common.SPreparedStatement setObject nil -1]
;   [com.databricks.client.jdbc.common.SPreparedStatement setObject nil -1]
;   [com.databricks.client.hivecommon.jdbc42.Hive42PreparedStatement setObject nil -1]
;   [metabase.db.jdbc_protocols$set_object invokeStatic jdbc_protocols.clj 25]
;   [metabase.db.jdbc_protocols$set_object invoke jdbc_protocols.clj 23]
;   [metabase.db.jdbc_protocols$eval75770$fn__75771 invoke jdbc_protocols.clj 39]
;   ...
;   [metabase.test.data.databricks_jdbc$eval184535$fn__184536$fn__184537 invoke databricks_jdbc.clj 74]
;   [metabase.driver.sql_jdbc.execute$eval128039$fn__128040$fn__128041 invoke execute.clj 390]
;;
;; Specifically, `set-parameter` implementations of `clojure.java.jdbc/ISQLParameter` defined in
;; [[metabase.db.jdbc-protocols]] come into play here.
;;
;; Databricks jdbc driver is unable to convert eg. LocalDate to java.sql.Date. To overcome values are converted into
;; java.sql.<TYPE> types.
;;
;; TODO: Check the conversion (when jdbc driver applies parameters) is correct! The instant is same!
;;
;; It may have undesired effect I'm not yet aware of. Analyzing test failures should reveal that.
;; Also I believe there is more reasonable way to do those transformations.
(defmethod sql.qp/->honeysql [:databricks-jdbc LocalDateTime]
  [_driver ^LocalDateTime value]
  (Timestamp/valueOf value))

(defmethod sql.qp/->honeysql [:databricks-jdbc LocalDate]
  [_driver ^LocalDate value]
  (Date/valueOf value))

(defmethod sql.qp/->honeysql [:databricks-jdbc ZonedDateTime]
  [_driver ^ZonedDateTime value]
  (t/instant->sql-timestamp (.toInstant value)))
