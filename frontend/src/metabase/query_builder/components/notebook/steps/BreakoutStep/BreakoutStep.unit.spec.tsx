import userEvent from "@testing-library/user-event";

import { fireEvent, screen, getIcon, within, render } from "__support__/ui";
import * as Lib from "metabase-lib";
import { createQueryWithClauses } from "metabase-lib/test-helpers";

import { createMockNotebookStep } from "../../test-utils";

import { BreakoutStep } from "./BreakoutStep";

function createQueryWithBreakout() {
  return createQueryWithClauses({
    breakouts: [{ tableName: "ORDERS", columnName: "TAX" }],
  });
}

function createQueryWithBinning(bucketName = "10 bins") {
  return createQueryWithClauses({
    breakouts: [
      {
        tableName: "ORDERS",
        columnName: "TAX",
        binningStrategyName: bucketName,
      },
    ],
  });
}

function createQueryWithTemporalBreakout(bucketName: string) {
  return createQueryWithClauses({
    breakouts: [
      {
        tableName: "ORDERS",
        columnName: "CREATED_AT",
        temporalBucketName: bucketName,
      },
    ],
  });
}

function setup(step = createMockNotebookStep()) {
  const updateQuery = jest.fn();

  render(
    <BreakoutStep
      step={step}
      stageIndex={step.stageIndex}
      query={step.query}
      color="summarize"
      isLastOpened={false}
      reportTimezone="UTC"
      updateQuery={updateQuery}
    />,
  );

  function getNextQuery(): Lib.Query {
    const [lastCall] = updateQuery.mock.calls.slice(-1);
    return lastCall[0];
  }

  function getRecentBreakoutClause() {
    const query = getNextQuery();
    const clause = Lib.breakouts(query, 0)[0];
    return Lib.displayInfo(query, 0, clause);
  }

  return {
    getNextQuery,
    getRecentBreakoutClause,
    updateQuery,
  };
}

describe("BreakoutStep", () => {
  it("should render correctly without a breakout", () => {
    setup();
    expect(screen.getByText("Pick a column to group by")).toBeInTheDocument();
  });

  it("should render a breakout correctly", async () => {
    const query = createQueryWithBreakout();
    setup(createMockNotebookStep({ query }));

    await userEvent.click(screen.getByText("Tax"));

    const listItem = await screen.findByRole("option", { name: "Tax" });
    expect(listItem).toBeInTheDocument();
    expect(listItem).toHaveAttribute("aria-selected", "true");
  });

  it("shouldn't show already used columns when adding a new breakout", async () => {
    const query = createQueryWithBreakout();
    setup(createMockNotebookStep({ query }));

    await userEvent.click(getIcon("add"));

    expect(
      screen.queryByRole("option", { name: "Tax" }),
    ).not.toBeInTheDocument();
  });

  it("should add a breakout", async () => {
    const { getRecentBreakoutClause } = setup();

    await userEvent.click(screen.getByText("Pick a column to group by"));
    await userEvent.click(await screen.findByText("Created At"));

    const breakout = getRecentBreakoutClause();
    expect(breakout.displayName).toBe("Created At: Month");
  });

  it("should change a breakout column", async () => {
    const query = createQueryWithBreakout();
    const { getRecentBreakoutClause } = setup(
      createMockNotebookStep({ query }),
    );

    await userEvent.click(screen.getByText("Tax"));
    await userEvent.click(await screen.findByText("Discount"));

    const breakout = getRecentBreakoutClause();
    expect(breakout.displayName).toBe("Discount: Auto binned");
  });

  it("should remove a breakout", async () => {
    const query = createQueryWithBreakout();
    const { getNextQuery } = setup(createMockNotebookStep({ query }));

    await userEvent.click(getIcon("close"));

    const nextQuery = getNextQuery();
    expect(Lib.breakouts(nextQuery, 0)).toHaveLength(0);
  });

  describe("bucketing", () => {
    it("should apply default binning strategy", async () => {
      const { getRecentBreakoutClause } = setup();

      await userEvent.click(screen.getByText("Pick a column to group by"));
      const option = await screen.findByRole("option", { name: "Total" });

      expect(within(option).getByText("Auto bin")).toBeInTheDocument();

      await userEvent.click(screen.getByText("Total"));

      const breakout = getRecentBreakoutClause();
      expect(breakout.displayName).toBe("Total: Auto binned");
    });

    it("should apply selected binning strategy", async () => {
      const { getRecentBreakoutClause } = setup();

      await userEvent.click(screen.getByText("Pick a column to group by"));
      const option = await screen.findByRole("option", { name: "Total" });
      await userEvent.click(within(option).getByLabelText("Binning strategy"));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "10 bins" }),
      );

      const breakout = getRecentBreakoutClause();
      expect(breakout.displayName).toBe("Total: 10 bins");
    });

    it("should highlight selected binning strategy", async () => {
      const query = createQueryWithBinning();
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Tax: 10 bins"));
      const option = await screen.findByRole("option", { name: "Tax" });
      await userEvent.click(within(option).getByLabelText("Binning strategy"));

      expect(
        await screen.findByRole("menuitem", { name: "10 bins" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("shouldn't update a query when clicking a selected binned column", async () => {
      const query = createQueryWithBinning();
      const { updateQuery } = setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Tax: 10 bins"));
      await userEvent.click(await screen.findByText("Tax"));

      expect(updateQuery).not.toHaveBeenCalled();
    });

    it("should highlight the `Don't bin` option when a column is not binned", async () => {
      const query = createQueryWithBinning("Don't bin");
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Tax"));
      const option = await screen.findByRole("option", {
        name: "Tax",
      });

      expect(within(option).getByText("Unbinned")).toBeInTheDocument();

      await userEvent.click(within(option).getByLabelText("Binning strategy"));
      expect(
        await screen.findByRole("menuitem", { name: "Don't bin" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("should apply default temporal bucket", async () => {
      const { getRecentBreakoutClause } = setup();

      await userEvent.click(screen.getByText("Pick a column to group by"));
      await userEvent.click(await screen.findByText("Created At"));

      const breakout = getRecentBreakoutClause();
      expect(breakout.displayName).toBe("Created At: Month");
    });

    it("should apply selected temporal bucket", async () => {
      const { getRecentBreakoutClause } = setup();

      await userEvent.click(screen.getByText("Pick a column to group by"));
      const option = await screen.findByRole("option", { name: "Created At" });
      await userEvent.click(within(option).getByLabelText("Temporal bucket"));

      // For some reason, a click won't happen with `userEvent.click`
      // if the test is running together with other tests.
      fireEvent.click(await screen.findByRole("menuitem", { name: "Quarter" }));

      const breakout = getRecentBreakoutClause();
      expect(breakout.displayName).toBe("Created At: Quarter");
    });

    it("should highlight selected temporal bucket", async () => {
      const query = createQueryWithTemporalBreakout("Quarter");
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Created At: Quarter"));
      const option = await screen.findByRole("option", { name: "Created At" });
      await userEvent.click(within(option).getByLabelText("Temporal bucket"));

      expect(
        await screen.findByRole("menuitem", { name: "Quarter" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("should show the temporal bucket for the current breakout in case there are multiple breakouts for the same column", async () => {
      const query = createQueryWithClauses({
        breakouts: [
          {
            tableName: "ORDERS",
            columnName: "CREATED_AT",
            temporalBucketName: "Hour",
          },
          {
            tableName: "ORDERS",
            columnName: "CREATED_AT",
            temporalBucketName: "Day",
          },
        ],
      });
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Created At: Hour"));
      const firstOption = await screen.findByRole("option", {
        name: "Created At",
      });
      await userEvent.click(within(firstOption).getByText("by hour"));
      expect(
        await screen.findByRole("menuitem", { name: "Hour" }),
      ).toHaveAttribute("aria-selected", "true");

      await userEvent.click(screen.getByText("Created At: Day"));
      const secondOption = await screen.findByRole("option", {
        name: "Created At",
      });
      await userEvent.click(within(secondOption).getByText("by day"));
      expect(
        await screen.findByRole("menuitem", { name: "Day" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("should show the binning strategy for the current breakout in case there are multiple breakouts for the same column", async () => {
      const query = createQueryWithClauses({
        breakouts: [
          {
            tableName: "ORDERS",
            columnName: "TAX",
            binningStrategyName: "10 bins",
          },
          {
            tableName: "ORDERS",
            columnName: "TAX",
            binningStrategyName: "50 bins",
          },
        ],
      });
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Tax: 10 bins"));
      const firstOption = await screen.findByRole("option", {
        name: "Tax",
      });
      await userEvent.click(within(firstOption).getByText("10 bins"));
      expect(
        await screen.findByRole("menuitem", { name: "10 bins" }),
      ).toHaveAttribute("aria-selected", "true");

      await userEvent.click(screen.getByText("Tax: 50 bins"));
      const secondOption = await screen.findByRole("option", {
        name: "Tax",
      });
      await userEvent.click(within(secondOption).getByText("50 bins"));
      expect(
        await screen.findByRole("menuitem", { name: "50 bins" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("should handle `Don't bin` option for temporal bucket (metabase#19684)", async () => {
      const query = createQueryWithTemporalBreakout("Don't bin");
      setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Created At"));
      const option = await screen.findByRole("option", {
        name: "Created At",
      });

      expect(within(option).getByText("Unbinned")).toBeInTheDocument();

      await userEvent.click(within(option).getByLabelText("Temporal bucket"));

      // click on More... item as Don't bin is hidden
      // userEvent.click closes popup
      fireEvent.click(await screen.findByText("More…"));

      expect(
        await screen.findByRole("menuitem", { name: "Don't bin" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("shouldn't update a query when clicking a selected column with temporal bucketing", async () => {
      const query = createQueryWithTemporalBreakout("Quarter");
      const { updateQuery } = setup(createMockNotebookStep({ query }));

      await userEvent.click(screen.getByText("Created At: Quarter"));
      await userEvent.click(await screen.findByText("Created At"));

      expect(updateQuery).not.toHaveBeenCalled();
    });
  });
});
