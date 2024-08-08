import { canonicalCollectionId } from "metabase/collections/utils";
import { useSelector } from "metabase/lib/redux";
import { PLUGIN_LLM_AUTODESCRIPTION } from "metabase/plugins";
import { getSubmittableQuestion } from "metabase/query_builder/selectors";
import type Question from "metabase-lib/v1/Question";

import type { FormValues } from "./types";

export const LLMSuggestionQuestionName = ({
  collectionId: collection_id,
  onAccept,
  question,
}: {
  collectionId: FormValues["collection_id"];
  question: Question;
  onAccept: (
    nextValues: Partial<Pick<FormValues, "name" | "description">>,
  ) => void;
}) => {
  const collectionId = canonicalCollectionId(collection_id);
  const questionWithCollectionId: Question =
    question.setCollectionId(collectionId);

  const submittableQuestion = useSelector(state =>
    getSubmittableQuestion(state, questionWithCollectionId),
  );

  return (
    <PLUGIN_LLM_AUTODESCRIPTION.LLMSuggestQuestionInfo
      question={submittableQuestion}
      onAccept={onAccept}
    />
  );
};
