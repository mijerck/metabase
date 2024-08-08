import { useEffect, useState } from "react";
import { useAsync } from "react-use";
import _ from "underscore";

import { CacheConfigApi } from "metabase/services";
import type {
  CacheConfigAPIResponse,
  CacheConfig,
  CacheableModel,
} from "metabase-types/api";

import { rootId } from "../constants/simple";
import { translateConfigFromAPI } from "../utils";

import { useRecentlyTrue } from "./useRecentlyTrue";
import { useListCacheConfigsQuery } from "metabase/api/cache";

export const useCacheConfigs = ({
  configurableModels,
  id,
}: {
  configurableModels: CacheableModel[];
  id?: number;
}) => {
  // Do multiple queries in parallel to get the cache configurations for each model, and combine the data, isFetching, and error states
  const { configsFromAPI, isFetching, error } = configurableModels.reduce(
    (acc, model) => {
      const { data, isFetching, error } = useListCacheConfigsQuery({
        model,
        id,
      });
      return {
        configsFromAPI: acc.configsFromAPI.concat(data?.data || []),
        isFetching: acc.isFetching || isFetching,
        error: acc.error || error,
      };
    },
    {
      configsFromAPI: [] as CacheConfig[],
      isFetching: false,
      error: null as unknown,
    },
  );
  const translatedConfigs = configsFromAPI.map(translateConfigFromAPI);

  const [configs, setConfigs] = useState<CacheConfig[]>([]);

  const rootStrategyOverriddenOnce = configs.some(
    config => config.model_id !== rootId,
  );

  const [rootStrategyRecentlyOverridden] = useRecentlyTrue(
    rootStrategyOverriddenOnce,
    3000,
  );

  // The configs are not considered fully loaded until the cache configuration data
  // has been loaded from the API _and_ has been copied into local state
  const [areConfigsInitialized, setAreConfigsInitialized] =
    useState<boolean>(false);
  const loading = isFetching || !areConfigsInitialized;

  useEffect(() => {
    if (translatedConfigs) {
      setConfigs(translatedConfigs);
      setAreConfigsInitialized(true);
    }
  }, [configsFromAPI]);

  return {
    error,
    loading,
    configs,
    setConfigs,
    configsFromAPI,
    rootStrategyOverriddenOnce,
    rootStrategyRecentlyOverridden,
  };
};
