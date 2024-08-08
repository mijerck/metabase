import { CacheConfig, CacheableModel } from "./performance";

export interface ListCacheConfigsRequest {
  model: CacheableModel;
}

export type ListCacheConfigsResponse = {
  data: CacheConfig[];
};

export interface GetCacheConfigRequest {
  model_id: number;
  model: CacheableModel;
}

export type UpdateCacheConfigRequest = CacheConfig;
