import { CacheConfig, CacheableModel } from "metabase-types/api";
import { Api } from "./api";
import {
  idTag,
  invalidateTags,
  listTag,
  provideCacheConfigListTags,
  provideCacheConfigTags,
} from "./tags";
import {
  GetCacheConfigRequest,
  ListCacheConfigsRequest,
  ListCacheConfigsResponse,
  UpdateCacheConfigRequest,
} from "metabase-types/api/cache-config";

export const cacheConfigApi = Api.injectEndpoints({
  endpoints: builder => ({
    listCacheConfigs: builder.query<
      ListCacheConfigsResponse,
      ListCacheConfigsRequest | void
    >({
      query: params => ({
        method: "GET",
        url: "/api/cache",
        params,
      }),
      providesTags: response =>
        provideCacheConfigListTags(response?.data ?? []),
    }),
    // FIXME: delete?
    // getCacheConfig: builder.query<CacheConfig, GetCacheConfigRequest>({
    //   query: ({ model, id }) => ({
    //     method: "GET",
    //     url: `/api/cache`,
    //     params: { model, id },
    //   }),
    //   providesTags: cacheConfig =>
    //     cacheConfig ? provideCacheConfigTags(cacheConfig) : [],
    // }),
    // createCacheConfig: builder.mutation<CacheConfig, CreateCacheConfigRequest>({
    //   query: body => ({
    //     method: "POST",
    //     url: "/api/dashboard",
    //     body,
    //   }),
    //   invalidatesTags: (newCacheConfig, error) =>
    //     newCacheConfig
    //       ? [
    //           ...invalidateTags(error, [listTag("dashboard")]),
    //           ...invalidateTags(error, [
    //             idTag("collection", newCacheConfig.collection_id ?? "root"),
    //           ]),
    //         ]
    //       : [],
    // }),
    updateCacheConfig: builder.mutation<CacheConfig, UpdateCacheConfigRequest>({
      query: (cacheConfig) => ({
        method: "PUT",
        url: `/api/cache`,
        {body: cacheConfig},
      }),
      invalidatesTags: (_, error, { id }) =>
        invalidateTags(error, [
          listTag("cache-config"),
          idTag("cache-config", id),
        ]),
    }),
    deleteCacheConfig: builder.mutation<
      void,
      { model: CacheableModel; model_id: number }
    >({
      query: ({ model, model_id }) => ({
        method: "DELETE",
        url: `/api/cache`,
        model,
        model_id,
      }),
      invalidatesTags: (_, error, { model, model_id }) =>
        invalidateTags(error, [
          listTag("cache-config"),
          idTag("cache-config", `${model},${model_id}`),
        ]),
    }),
    invalidateCacheConfig: builder.mutation<
      void,
      { model: CacheableModel; model_id: number }
    >({
      query: ({ model, model_id }) => ({
        method: "POST",
        url: `/api/cache/invalidate`,
        model,
        model_id,
      }),
    }),
  }),
});

export const {
  useGetCacheConfigQuery,
  useListCacheConfigsQuery,
  useCreateCacheConfigMutation,
  useUpdateCacheConfigMutation,
  useSaveCacheConfigMutation,
  useDeleteCacheConfigMutation,
} = cacheConfigApi;
