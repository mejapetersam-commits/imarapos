import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient, authConfigured, getToken } from "@/auth";
import {
  adjustStock as adjustStockFn,
  createBusiness as createBusinessFn,
  createCategory as createCategoryFn,
  createProduct as createProductFn,
  listBusinesses,
  loadBusinessData as loadBusinessDataFn,
  type Result,
} from "@/api/functions";
import { isValidNewProduct, isValidStockAdjustment } from "@/lib/pos-rules";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pos/AppShell";
import { AuthScreen } from "@/components/pos/AuthScreen";
import { Dashboard } from "@/components/pos/Dashboard";
import { BusinessForm, CategoryForm, ProductForm, StockForm } from "@/components/pos/Forms";
import { Inventory } from "@/components/pos/Inventory";
import type { AuthMode, Business, Category, Page, Product } from "@/components/pos/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kioo POS — Business dashboard" },
      { name: "description", content: "Sales, stock, and business operations in one clear view." },
      { property: "og:title", content: "Kioo POS — Business dashboard" },
      {
        property: "og:description",
        content: "Sales, stock, and business operations in one clear view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<{ id: string; email?: string | undefined } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [profileName, setProfileName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState<Product | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const session = authClient.useSession();
  useEffect(() => {
    if (session.isPending) return;
    const current = session.data?.user;
    setUser(current ? { id: current.id, email: current.email } : null);
    setProfileName(current?.name ?? "");
    setAuthChecked(true);
  }, [session.isPending, session.data?.user?.id, session.data?.user?.name]);

  useEffect(() => {
    if (user) {
      void loadBusinesses();
    } else {
      setBusinesses([]);
      setActiveBusiness(null);
      setProducts([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeBusiness) void loadBusinessData(activeBusiness);
  }, [activeBusiness?.id]);

  /** Calls a server function with the current session token; shows the error toast and returns null on failure. */
  async function api<T>(call: (token: string) => Promise<Result<T>>): Promise<T | null> {
    const token = await getToken();
    if (!token) {
      toast.error("Your session has expired. Please sign in again.");
      return null;
    }
    const result = await call(token);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data;
  }

  async function loadBusinesses() {
    setLoadError(false);
    const rows = await api((token) => listBusinesses({ data: { token } }));
    if (!rows) {
      setLoadError(true);
      return;
    }
    setBusinesses(rows);
    setActiveBusiness(
      (current) => rows.find((business) => business.id === current?.id) ?? rows[0] ?? null,
    );
    if (!rows.length) setShowBusinessForm(true);
  }

  async function loadBusinessData(business: Business) {
    setLoading(true);
    const result = await api((token) =>
      loadBusinessDataFn({ data: { token, businessId: business.id } }),
    );
    if (result) {
      const categoriesById = new Map(result.categories.map((row) => [row.id, row.name]));
      setProducts(
        result.products.map((row) => ({
          id: row.id,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category_id: row.category_id,
          cost_price: row.cost_price,
          selling_price: row.selling_price,
          low_stock_threshold: row.low_stock_threshold,
          active: row.active,
          inventory:
            row.quantity_on_hand === null ? null : { quantity_on_hand: row.quantity_on_hand },
          category: row.category_id
            ? (categoriesById.get(row.category_id) ?? "Uncategorised")
            : "Uncategorised",
        })),
      );
      setCategories(result.categories);
      setSalesCount(result.salesCount);
      setRevenue(result.revenue);
      setCustomersCount(result.customersCount);
    }
    setLoading(false);
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authConfigured) {
      toast.error(
        "Sign-in is not configured: VITE_NEON_AUTH_URL was missing at build time. Add it in Vercel, then redeploy.",
      );
      return;
    }
    setAuthBusy(true);
    setNeedsEmailConfirmation(false);
    try {
      const request =
        authMode === "signup"
          ? authClient.signUp.email({
              email: authEmail,
              password: authPassword,
              name: authName.trim(),
            })
          : authClient.signIn.email({ email: authEmail, password: authPassword });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "The sign-in service did not respond. Check the auth URL and trusted domains.",
              ),
            ),
          20000,
        ),
      );
      const { data, error } = await Promise.race([request, timeout]);
      if (error) toast.error(error.message ?? "Could not complete that request.");
      else if (authMode === "signup" && !(data as { token?: string | null } | null)?.token)
        setNeedsEmailConfirmation(true);
      else toast.success(authMode === "signup" ? "Your account is ready." : "Welcome back.");
    } catch (error) {
      console.error("Auth request failed", error);
      toast.error(error instanceof Error ? error.message : "Could not reach the sign-in service.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function createBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("businessName") ?? "").trim();
    if (!name) return;
    const business = await api((token) => createBusinessFn({ data: { token, name } }));
    if (!business) return;
    setBusinesses((current) => [...current, business]);
    setActiveBusiness(business);
    setShowBusinessForm(false);
    toast.success("Business created.");
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness) return;
    const form = new FormData(event.currentTarget);
    const product = {
      name: String(form.get("name") ?? "").trim(),
      sku: String(form.get("sku") ?? "").trim(),
      barcode: String(form.get("barcode") ?? "").trim(),
      category_id: String(form.get("categoryId") ?? "") || null,
      cost_price: Number(form.get("costPrice")),
      selling_price: Number(form.get("sellingPrice")),
      low_stock_threshold: Number(form.get("threshold")),
      initial_stock: Number(form.get("initialStock")),
    };
    if (!isValidNewProduct(product)) {
      toast.error("Check the product details and enter zero or higher for prices and stock.");
      return;
    }
    const id = await api((token) =>
      createProductFn({
        data: {
          token,
          businessId: activeBusiness.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || null,
          categoryId: product.category_id,
          costPrice: product.cost_price,
          sellingPrice: product.selling_price,
          lowStockThreshold: product.low_stock_threshold,
          initialStock: product.initial_stock,
        },
      }),
    );
    if (!id) return;
    setShowProductForm(false);
    toast.success("Product added to inventory.");
    await loadBusinessData(activeBusiness);
  }

  async function adjustStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness || !showStockForm) return;
    const form = new FormData(event.currentTarget);
    const delta = Number(form.get("quantity"));
    const current = showStockForm.inventory?.quantity_on_hand ?? 0;
    if (!isValidStockAdjustment(current, delta)) {
      toast.error("That adjustment would leave stock below zero.");
      return;
    }
    const note = String(form.get("reason") ?? "").trim() || "Manual adjustment";
    const quantity = await api((token) =>
      adjustStockFn({
        data: { token, businessId: activeBusiness.id, productId: showStockForm.id, delta, note },
      }),
    );
    if (quantity === null) return;
    setShowStockForm(null);
    toast.success("Stock updated.");
    await loadBusinessData(activeBusiness);
  }

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("categoryName") ?? "").trim();
    if (!name) return;
    const category = await api((token) =>
      createCategoryFn({ data: { token, businessId: activeBusiness.id, name } }),
    );
    if (!category) return;
    setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success("Category added.");
  }

  async function signOut() {
    await authClient.signOut();
    setUser(null);
  }

  if (!authChecked)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="size-7 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  if (!user)
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        name={authName}
        setName={setAuthName}
        busy={authBusy}
        confirmation={needsEmailConfirmation}
        onBack={() => {
          setNeedsEmailConfirmation(false);
          setAuthMode("signin");
        }}
        onSubmit={handleAuthSubmit}
      />
    );

  return (
    <AppShell
      page={activePage}
      onNavigate={setActivePage}
      businesses={businesses}
      active={activeBusiness}
      onSwitch={(id) => setActiveBusiness(businesses.find((b) => b.id === id) ?? null)}
      onNewBusiness={() => setShowBusinessForm(true)}
      userName={profileName}
      userEmail={user.email ?? ""}
      onSignOut={signOut}
    >
      {!activeBusiness ? (
        loadError ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">We couldn’t load your workspace</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You’re signed in, but the server could not verify your session or reach the database.
              The message above has the detail.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => void loadBusinesses()}>Try again</Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-24">
            <LoaderCircle
              className="size-7 animate-spin text-muted-foreground"
              aria-label="Loading"
            />
          </div>
        )
      ) : activePage === "dashboard" ? (
        <Dashboard
          name={activeBusiness.name}
          products={products}
          revenue={revenue}
          salesCount={salesCount}
          customersCount={customersCount}
          categoriesCount={categories.length}
          loading={loading}
          onAddProduct={() => setShowProductForm(true)}
          onOpenInventory={() => setActivePage("inventory")}
        />
      ) : (
        <Inventory
          products={products}
          categories={categories}
          loading={loading}
          onAddProduct={() => setShowProductForm(true)}
          onAddCategory={() => setShowCategoryForm(true)}
          onAdjust={setShowStockForm}
        />
      )}
      {showBusinessForm && (
        <BusinessForm
          onSubmit={createBusiness}
          onCancel={() => setShowBusinessForm(false)}
          canCancel={businesses.length > 0}
        />
      )}
      {showCategoryForm && (
        <CategoryForm
          categories={categories}
          onSubmit={createCategory}
          onClose={() => setShowCategoryForm(false)}
        />
      )}
      {showProductForm && (
        <ProductForm
          categories={categories}
          onSubmit={createProduct}
          onClose={() => setShowProductForm(false)}
        />
      )}
      {showStockForm && (
        <StockForm
          product={showStockForm}
          onSubmit={adjustStock}
          onClose={() => setShowStockForm(null)}
        />
      )}
    </AppShell>
  );
}
