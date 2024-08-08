import { useEffect, useMemo, useState } from "react";

import type { CacheConfig, CacheableModel } from "metabase-types/api";

import { rootId } from "../constants/simple";
import { translateConfigFromAPI } from "../utils";

import { useRecentlyTrue } from "./useRecentlyTrue";
import { useListCacheConfigsQuery } from "metabase/api/cache";
import { skipToken } from "@reduxjs/toolkit/query";

const useListCacheConfigsForModel = (
  configurableModels: CacheableModel[],
  model: CacheableModel,
  id?: number,
) =>
  useListCacheConfigsQuery(
    configurableModels.includes(model)
      ? {
          model,
          id,
        }
      : skipToken,
  );

export const useCacheConfigs = ({
  configurableModels,
  id,
}: {
  configurableModels: CacheableModel[];
  id?: number;
}) => {
  const results = [
    useListCacheConfigsForModel(configurableModels, "root", id),
    useListCacheConfigsForModel(configurableModels, "database", id),
    useListCacheConfigsForModel(configurableModels, "dashboard", id),
    useListCacheConfigsForModel(configurableModels, "question", id),
  ];
  const { configsFromAPI, isFetching, error } = useMemo(() => {
    const configsFromAPI = results.map(result => result.data?.data);
    const error = results.find(result => result.error)?.error;
    const isFetching = results.some(result => result.isFetching);
    return { configsFromAPI, isFetching, error };
  }, [results]);

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
    if (configsFromAPI) {
      const flattenedConfigs = configsFromAPI
        .flat()
        .filter(Boolean) as CacheConfig[];
      const translatedConfigs = [...flattenedConfigs].map(
        translateConfigFromAPI,
      );
      setConfigs(translatedConfigs);
      setAreConfigsInitialized(true);
    }
  }, [...configsFromAPI]);

  return {
    error,
    loading,
    configs,
    setConfigs,
    rootStrategyOverriddenOnce,
    rootStrategyRecentlyOverridden,
  };
};
