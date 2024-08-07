import userEvent from "@testing-library/user-event";

import { screen } from "__support__/ui";

import { setupDashboardSharingMenu, openMenu } from "./setup";

describe("DashboardSharingMenu", () => {
  describe("dashboard subscriptions", () => {
    ["admin", "non-admin"].forEach(userType => {
      it(`${userType}: should always show the "Subscriptions" menu item`, async () => {
        setupDashboardSharingMenu({ isAdmin: userType === "admin" });
        await openMenu();
        expect(screen.getByText("Subscriptions")).toBeInTheDocument();
      });

      it(`${userType}: should toggle the subscriptions sidebar on click`, async () => {
        setupDashboardSharingMenu({ isAdmin: userType === "admin" });
        await openMenu();
        await userEvent.click(screen.getByText("Subscriptions"));
        expect(screen.getByTestId("fake-sidebar")).toHaveTextContent(
          "Sidebar: sharing",
        );
      });
    });
  });

  describe("pdf export", () => {
    ["admin", "non-admin"].forEach(userType => {
      it(`should show the "Export as PDF" menu item for ${userType}`, async () => {
        setupDashboardSharingMenu({ isAdmin: userType === "admin" });
        await openMenu();
        expect(screen.getByText("Export as PDF")).toBeInTheDocument();
      });

      it(`should show the "Export tab as PDF" menu item for ${userType} for a dashboard with multiple tabs`, async () => {
        setupDashboardSharingMenu({
          isAdmin: userType === "admin",
          dashboard: {
            tabs: [
              { id: 1, name: "First Tab" },
              { id: 2, name: "Second Tab" },
            ] as any,
          },
        });
        await openMenu();
        expect(screen.getByText("Export tab as PDF")).toBeInTheDocument();
      });
    });
  });

  describe("public links", () => {
    describe("admins", () => {
      it('should show a "Create Public link" menu item if public sharing is enabled', async () => {
        setupDashboardSharingMenu({
          isAdmin: true,
          isPublicSharingEnabled: true,
        });
        await openMenu();
        expect(screen.getByText("Create a public link")).toBeInTheDocument();
      });

      it('should show a "Public link" menu item if public sharing is enabled and a public link exists already', async () => {
        setupDashboardSharingMenu({
          isAdmin: true,
          isPublicSharingEnabled: true,
          hasPublicLink: true,
        });
        await openMenu();
        expect(screen.getByText("Public link")).toBeInTheDocument();
        expect(
          screen.queryByText("Create a public link"),
        ).not.toBeInTheDocument();
      });

      it("should show a 'public links are off' menu item if public sharing is disabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: true,
          isPublicSharingEnabled: false,
        });
        await openMenu();
        expect(screen.getByText("Public links are off")).toBeInTheDocument();
        expect(
          screen.queryByText("Create a public link"),
        ).not.toBeInTheDocument();
      });

      // note: if public sharing is disabled, the dashboard object provided by the backend should not have a UUID
    });

    describe("non-admins", () => {
      it('should show a "Public link" menu item if public sharing is enabled and a public link exists already', async () => {
        setupDashboardSharingMenu({
          isAdmin: false,
          isPublicSharingEnabled: true,
          hasPublicLink: true,
        });
        await openMenu();
        expect(screen.getByText("Public link")).toBeInTheDocument();
        expect(
          screen.queryByText("Create a public link"),
        ).not.toBeInTheDocument();
      });

      it("should show a 'ask your admin to create a public link' menu item if public sharing is disabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: false,
          isPublicSharingEnabled: false,
          hasPublicLink: true,
        });
        await openMenu();
        expect(
          screen.getByText("Ask your admin to create a public link"),
        ).toBeInTheDocument();
      });

      it("should show a 'ask your admin to create a public link' menu item if public sharing is enabled, but there is no existing public link", async () => {
        setupDashboardSharingMenu({
          isAdmin: false,
          isPublicSharingEnabled: true,
          hasPublicLink: false,
        });
        await openMenu();
        expect(
          screen.getByText("Ask your admin to create a public link"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("embedding", () => {
    describe("admins", () => {
      it("should show the 'Embed' menu item if embedding is enabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: true,
          isEmbeddingEnabled: true,
        });
        await openMenu();
        expect(screen.getByText("Embed")).toBeInTheDocument();
      });

      it("should show an 'embedding is off' menu item if embedding is disabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: true,
          isEmbeddingEnabled: false,
        });
        await openMenu();
        expect(screen.getByText("Embedding is off")).toBeInTheDocument();
      });
    });

    describe("non-admins", () => {
      it("should not show the 'Embed' menu item if embedding is enabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: false,
          isEmbeddingEnabled: true,
        });
        await openMenu();
        expect(screen.queryByText("Embed")).not.toBeInTheDocument();
      });

      it("should not show the 'Embed' menu item if embedding is disabled", async () => {
        setupDashboardSharingMenu({
          isAdmin: false,
          isEmbeddingEnabled: false,
        });
        await openMenu();
        expect(screen.queryByText("Embed")).not.toBeInTheDocument();
      });
    });
  });
});
