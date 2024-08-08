import { useCallback, useMemo, useState } from "react";
import * as Yup from "yup";

import { useCollectionListQuery } from "metabase/common/hooks";
import { FormProvider } from "metabase/forms";
import * as Errors from "metabase/lib/errors";
import { useSelector } from "metabase/lib/redux";
import { getIsSavedQuestionChanged } from "metabase/query_builder/selectors";
import { Flex, Modal } from "metabase/ui";

import { LLMSuggestionQuestionName } from "./LLMSuggestionQuestionName";
import { SaveQuestionForm } from "./SaveQuestionForm";
import type { FormValues, SaveQuestionModalProps } from "./types";
import {
  getInitialValues,
  getPlaceholder,
  getTitle,
  submitQuestion,
} from "./util";

export const SAVE_QUESTION_SCHEMA = Yup.object({
  saveType: Yup.string(),
  name: Yup.string().when("saveType", {
    // We don't care if the form is valid when overwrite mode is enabled,
    // as original question's data will be submitted instead of the form values
    is: (value: string) => value !== "overwrite",
    then: Yup.string().required(Errors.required),
    otherwise: Yup.string().nullable(true),
  }),
});

export const SaveQuestionModal = ({
  question,
  originalQuestion: latestOriginalQuestion,
  onCreate,
  onSave,
  onClose,
  multiStep = false,
  initialCollectionId,
}: SaveQuestionModalProps) => {
  const { data: collections = [] } = useCollectionListQuery();

  // originalQuestion from props changes during saving
  const [originalQuestion] = useState(latestOriginalQuestion);

  const isSavedQuestionChanged = useSelector(getIsSavedQuestionChanged);
  // we care only about the very first result as question can be changed before
  // the modal is closed
  const [isSavedQuestionInitiallyChanged] = useState(isSavedQuestionChanged);

  const initialValues: FormValues = useMemo(
    () =>
      getInitialValues(
        collections,
        originalQuestion,
        question,
        initialCollectionId,
      ),
    [collections, initialCollectionId, originalQuestion, question],
  );

  const handleSubmit = useCallback(
    async (details: FormValues) => {
      await submitQuestion(
        originalQuestion,
        details,
        question,
        onSave,
        onCreate,
      );
    },
    [originalQuestion, question, onSave, onCreate],
  );

  const showSaveType =
    isSavedQuestionInitiallyChanged &&
    originalQuestion != null &&
    originalQuestion.canWrite();

  const cardType = question.type();
  const nameInputPlaceholder = getPlaceholder(cardType);
  const title = getTitle(cardType, showSaveType, multiStep);

  return (
    <Modal.Root onClose={onClose} opened={true}>
      <Modal.Overlay />
      <FormProvider
        initialValues={{ ...initialValues }}
        onSubmit={handleSubmit}
        validationSchema={SAVE_QUESTION_SCHEMA}
        enableReinitialize
      >
        {({ values, setValues }) => (
          <Modal.Content p="md" data-testid="save-question-modal">
            <Modal.Header>
              <Modal.Title>{title}</Modal.Title>
              <Flex align="center" justify="flex-end" gap="sm">
                <LLMSuggestionQuestionName
                  onAccept={nextValues =>
                    setValues({ ...values, ...nextValues })
                  }
                  collectionId={initialValues.collection_id}
                  question={question}
                />
                <Modal.CloseButton />
              </Flex>
            </Modal.Header>
            <Modal.Body>
              <SaveQuestionForm
                showSaveType={showSaveType}
                originalQuestion={originalQuestion}
                values={values}
                placeholder={nameInputPlaceholder}
                onCancel={onClose}
              />
            </Modal.Body>
          </Modal.Content>
        )}
      </FormProvider>
    </Modal.Root>
  );
};
