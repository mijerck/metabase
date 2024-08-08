import { useState } from "react";

import {
  InteractiveQuestionProvider,
  useInteractiveQuestionContext,
} from "embedding-sdk/components/public/InteractiveQuestion/context";
import { useListCollectionsQuery } from "metabase/api";
import type { FormValues } from "metabase/containers/SaveQuestionModal";
import {
  SAVE_QUESTION_SCHEMA,
  SaveQuestionForm,
  createQuestion,
  getInitialValues,
  getPlaceholder,
  getTitle,
} from "metabase/containers/SaveQuestionModal";
import { FormProvider } from "metabase/forms";
import { useSelector } from "metabase/lib/redux";
import { useCreateQuestion } from "metabase/query_builder/containers/use-create-question";
import { getMetadata } from "metabase/selectors/metadata";
import { Box, Button, Stack, Tabs, Title, Group, Overlay } from "metabase/ui";
import Question from "metabase-lib/v1/Question";

import {
  Notebook,
  QuestionVisualization,
} from "../InteractiveQuestion/components";

const SaveNewQuestion = ({ onClose }: { onClose?: () => void } = {}) => {
  const { question } = useInteractiveQuestionContext();
  const { handleCreate } = useCreateQuestion();

  const { data: collections = [] } = useListCollectionsQuery({});

  if (!question) {
    return null;
  }

  const initialValues = getInitialValues(collections, null, question, null);
  const placeholder = getPlaceholder(question.type());
  const title = getTitle(question.type());

  const handleSubmit = async (details: FormValues) => {
    await createQuestion(details, question, handleCreate);
  };

  return (
    <FormProvider
      initialValues={{ ...initialValues }}
      onSubmit={handleSubmit}
      validationSchema={SAVE_QUESTION_SCHEMA}
      enableReinitialize
    >
      {({ values }) => (
        <Stack>
          <Title>{title}</Title>
          <SaveQuestionForm
            showSaveType={false}
            originalQuestion={null}
            values={values}
            placeholder={placeholder}
            onCancel={onClose}
          />
        </Stack>
      )}
    </FormProvider>
  );
};

export const NewQuestion = () => {
  const metadata = useSelector(getMetadata);
  const newCard = Question.create({ metadata }).card();

  const [isSaving, setIsSaving] = useState(false);

  return (
    <InteractiveQuestionProvider deserializedCard={newCard} options={{}}>
      <Box w="100%" h="100%" pos="relative">
        {isSaving && (
          <Overlay bg="bg-white">
            <SaveNewQuestion onClose={() => setIsSaving(false)} />
          </Overlay>
        )}
        <Tabs defaultValue="notebook">
          <Group position="apart">
            <Tabs.List>
              <Tabs.Tab value="notebook">Notebook</Tabs.Tab>
              <Tabs.Tab value="visualization">Visualization</Tabs.Tab>
            </Tabs.List>
            <Button onClick={() => setIsSaving(true)}>Save</Button>
          </Group>

          <Tabs.Panel value="notebook">
            <Notebook />
          </Tabs.Panel>
          <Tabs.Panel value="visualization">
            <QuestionVisualization />
          </Tabs.Panel>
        </Tabs>
      </Box>
    </InteractiveQuestionProvider>
  );
};
