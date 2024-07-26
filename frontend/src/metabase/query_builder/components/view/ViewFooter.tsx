/* eslint-disable react/prop-types */
import cx from "classnames";
import { useCallback } from "react";
import { t } from "ttag";

import ButtonBar from "metabase/components/ButtonBar";
import CS from "metabase/css/core/index.css";
import { EmbedMenu } from "metabase/dashboard/components/EmbedMenu";
import { useDispatch, useSelector } from "metabase/lib/redux";
import { ResourceEmbedButton } from "metabase/public/components/ResourceEmbedButton";
import {
  onCloseChartSettings,
  onOpenChartSettings,
  onCloseChartType,
  onOpenChartType,
  setUIControls,
  onOpenTimelines,
  onCloseTimelines,
} from "metabase/query_builder/actions";
import QueryDownloadWidget from "metabase/query_builder/components/QueryDownloadWidget";
import {
  MODAL_TYPES,
  type QueryModalType,
} from "metabase/query_builder/constants";
import {
  getFirstQueryResult,
  getIsObjectDetail,
  getIsTimeseries,
  getIsVisualized,
  getQuestion,
  getQuestionAlerts,
  getUiControls,
  getVisualizationSettings,
} from "metabase/query_builder/selectors";
import { canManageSubscriptions as canManageSubscriptionsSelector } from "metabase/selectors/user";
import * as Lib from "metabase-lib";

import { ExecutionTime } from "./ExecutionTime";
import QuestionAlertWidget from "./QuestionAlertWidget";
import QuestionDisplayToggle from "./QuestionDisplayToggle";
import QuestionLastUpdated from "./QuestionLastUpdated";
import QuestionRowCount from "./QuestionRowCount";
import QuestionTimelineWidget from "./QuestionTimelineWidget";
import ViewButton from "./ViewButton";
import { FooterButtonGroup, ViewFooterRoot } from "./ViewFooter.styled";

export const ViewFooter = ({ className }: { className?: string }) => {
  const dispatch = useDispatch();

  const {
    question,
    result,
    uiControls,
    isObjectDetail,
    questionAlerts,
    visualizationSettings,
    canManageSubscriptions,
    isVisualized,
    isTimeseries,
  } = useSelector(state => ({
    question: getQuestion(state),
    result: getFirstQueryResult(state),
    uiControls: getUiControls(state),
    isObjectDetail: getIsObjectDetail(state),
    questionAlerts: getQuestionAlerts(state),
    visualizationSettings: getVisualizationSettings(state),
    canManageSubscriptions: canManageSubscriptionsSelector(state),
    isVisualized: getIsVisualized(state),
    isTimeseries: getIsTimeseries(state),
  }));

  const {
    isShowingChartTypeSidebar,
    isShowingChartSettingsSidebar,
    isShowingRawTable,
    isShowingTimelineSidebar,
  } = uiControls;

  const onOpenModal = useCallback(
    (modal: QueryModalType, modalContext?: unknown) =>
      dispatch(setUIControls({ modal, modalContext })),
    [dispatch],
  );
  if (!result || !question) {
    return null;
  }

  const { isEditable } = Lib.queryDisplayInfo(question.query());
  const hideChartSettings =
    (result.error && !isEditable) || question.isArchived();
  const type = question.type();

  return (
    <ViewFooterRoot
      className={cx(className, CS.textMedium, CS.borderTop)}
      data-testid="view-footer"
    >
      <ButtonBar
        className={CS.flexFull}
        left={[
          !hideChartSettings && (
            <FooterButtonGroup>
              <ViewButton
                medium
                labelBreakpoint="sm"
                data-testid="viz-type-button"
                active={isShowingChartTypeSidebar}
                onClick={
                  isShowingChartTypeSidebar
                    ? () => dispatch(onCloseChartType())
                    : () => dispatch(onOpenChartType())
                }
              >
                {t`Visualization`}
              </ViewButton>
              <ViewButton
                active={isShowingChartSettingsSidebar}
                icon="gear"
                iconSize={16}
                medium
                onlyIcon
                labelBreakpoint="sm"
                data-testid="viz-settings-button"
                onClick={
                  isShowingChartSettingsSidebar
                    ? () => dispatch(onCloseChartSettings())
                    : () => dispatch(onOpenChartSettings())
                }
              />
            </FooterButtonGroup>
          ),
        ]}
        center={
          isVisualized && (
            <QuestionDisplayToggle
              key="viz-table-toggle"
              className={CS.mx1}
              question={question}
              isShowingRawTable={isShowingRawTable}
              onToggleRawTable={isShowingRawTable => {
                setUIControls({ isShowingRawTable });
              }}
            />
          )
        }
        right={[
          QuestionRowCount.shouldRender({
            result,
            isObjectDetail,
          }) && <QuestionRowCount key="row_count" />,
          <ExecutionTime key="execution_time" time={result.running_time} />,
          QuestionLastUpdated.shouldRender({ result }) && (
            <QuestionLastUpdated
              key="last-updated"
              className={cx(CS.hide, CS.smShow)}
              result={result}
            />
          ),
          QueryDownloadWidget.shouldRender({ result }) && (
            <QueryDownloadWidget
              key="download"
              className={cx(CS.hide, CS.smShow)}
              question={question}
              result={result}
              visualizationSettings={visualizationSettings}
              dashcardId={question.card().dashcardId}
              dashboardId={question.card().dashboardId}
            />
          ),
          QuestionAlertWidget.shouldRender({
            question,
            visualizationSettings,
          }) && (
            <QuestionAlertWidget
              key="alerts"
              className={cx(CS.hide, CS.smShow)}
              canManageSubscriptions={canManageSubscriptions}
              question={question}
              questionAlerts={questionAlerts}
              onCreateAlert={() =>
                question.isSaved()
                  ? onOpenModal("create-alert")
                  : onOpenModal("save-question-before-alert")
              }
            />
          ),
          type === "question" &&
            !question.isArchived() &&
            (question.isSaved() ? (
              <EmbedMenu
                key="embed"
                resource={question}
                resourceType="question"
                hasPublicLink={!!question.publicUUID()}
                onModalOpen={() => onOpenModal(MODAL_TYPES.EMBED)}
              />
            ) : (
              <ResourceEmbedButton
                hasBackground={false}
                onClick={() =>
                  onOpenModal(MODAL_TYPES.SAVE_QUESTION_BEFORE_EMBED)
                }
              />
            )),
          QuestionTimelineWidget.shouldRender({ isTimeseries }) && (
            <QuestionTimelineWidget
              key="timelines"
              className={cx(CS.hide, CS.smShow)}
              isShowingTimelineSidebar={isShowingTimelineSidebar}
              onOpenTimelines={() => dispatch(onOpenTimelines())}
              onCloseTimelines={() => dispatch(onCloseTimelines())}
            />
          ),
        ]}
      />
    </ViewFooterRoot>
  );
};
