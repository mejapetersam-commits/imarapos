import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidNewProduct, isValidStockAdjustment } from "@/lib/pos-rules";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Download,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  PackagePlus,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

type Business = { id: string; name: string; currency: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  active: boolean;
  inventory: { quantity_on_hand: number } | null;
  category: string;
};
type Category = { id: string; name: string };
type AuthMode = "signin" | "signup";

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
  const [query, setQuery] = useState("");
  const [activePage, setActivePage] = useState<"dashboard" | "inventory">("dashboard");
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
    const rows = await api((token) => listBusinesses({ data: { token } }));
    if (!rows) return;
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

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter(
      (product) =>
        !term ||
        [product.name, product.sku, product.barcode, product.category].some((value) =>
          value?.toLowerCase().includes(term),
        ),
    );
  }, [products, query]);
  const lowStockCount = products.filter(
    (product) => (product.inventory?.quantity_on_hand ?? 0) <= product.low_stock_threshold,
  ).length;
  const stockValue = products.reduce(
    (sum, product) =>
      sum + Number(product.inventory?.quantity_on_hand ?? 0) * Number(product.cost_price),
    0,
  );

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
      <SignInScreen
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
        onSubmit={handleAuthSubmit}
      />
    );

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <aside className="app-sidebar hidden lg:flex">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Boxes size={20} strokeWidth={2.3} />
          </div>
          <span>
            Kioo<span className="brand-light">POS</span>
          </span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button
          className="workspace-switch"
          onClick={() => setShowBusinessForm(true)}
          aria-label="Switch or add business"
        >
          <span className="workspace-icon">
            <Building2 size={17} />
          </span>
          <span className="workspace-name">
            {activeBusiness?.name ?? "Your business"}
            <small>Kenya · KES</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-group-label">BUSINESS</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button
            className={activePage === "dashboard" ? "nav-link active" : "nav-link"}
            onClick={() => setActivePage("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>
          <button
            className={activePage === "inventory" ? "nav-link active" : "nav-link"}
            onClick={() => setActivePage("inventory")}
          >
            <PackagePlus size={18} />
            <span>Inventory</span>
            {lowStockCount > 0 && <span className="nav-count">{lowStockCount}</span>}
          </button>
          <button
            className="nav-link"
            onClick={() => toast.info("Sales and checkout are next in the build roadmap.")}
          >
            <ShoppingCart size={18} />
            <span>Sales & checkout</span>
          </button>
          <button
            className="nav-link"
            onClick={() => toast.info("Customer records are next in the build roadmap.")}
          >
            <Users size={18} />
            <span>Customers</span>
          </button>
          <button
            className="nav-link"
            onClick={() => toast.info("Payments and reconciliation are next in the build roadmap.")}
          >
            <CreditCard size={18} />
            <span>Payments</span>
          </button>
          <button
            className="nav-link"
            onClick={() => toast.info("Reports are next in the build roadmap.")}
          >
            <BarChart3 size={18} />
            <span>Reports</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-note">
            <div className="plan-note-icon">
              <Sparkles size={15} />
            </div>
            <div>
              <b>Built for business</b>
              <span>Made for the way you work.</span>
            </div>
          </div>
          <button
            className="nav-link"
            onClick={() => toast.info("Business settings are coming in a later stage.")}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </button>
          <div className="profile-strip">
            <div className="profile-avatar">
              {(profileName || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="profile-copy">
              <b>{profileName || "Account"}</b>
              <span>{user.email}</span>
            </div>
            <button
              className="icon-action"
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div className="mobile-brand lg:hidden">
            <div className="brand-mark">
              <Boxes size={18} />
            </div>
            <span>
              Kioo<span className="brand-light">POS</span>
            </span>
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-divider">/</span>
            <b>{activePage === "dashboard" ? "Overview" : "Inventory"}</b>
          </div>
          <div className="topbar-actions">
            <span className="live-status">
              <span /> Live data
            </span>
            <button
              className="icon-action help-action"
              title="Help"
              aria-label="Help"
              onClick={() => toast.info("Your business records are private to your team.")}
            >
              <CircleHelp size={18} />
            </button>
            <button
              className="mobile-menu icon-action"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void signOut()}
            >
              <Menu size={19} />
            </button>
            <div className="top-avatar">
              {(profileName || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {!activeBusiness ? (
          <div className="setup-empty">
            <div className="setup-illustration">
              <Building2 size={27} />
            </div>
            <p className="eyebrow">A fresh start</p>
            <h1>Set up your business</h1>
            <p>Add your shop or company to start managing products and sales.</p>
            <Button onClick={() => setShowBusinessForm(true)}>
              <Plus /> Add a business
            </Button>
          </div>
        ) : (
          <div className="page-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">{activeBusiness.name}</p>
                <h1>
                  {activePage === "dashboard"
                    ? "Good business starts with a clear view."
                    : "Inventory"}
                </h1>
                <p className="page-subtitle">
                  {activePage === "dashboard"
                    ? "Your day, at a glance."
                    : "Keep products, pricing, and stock in check."}
                </p>
              </div>
              <div className="heading-actions">
                <Button
                  variant="outline"
                  className="date-button"
                  onClick={() =>
                    toast.info("Metrics reflect the business records currently saved.")
                  }
                >
                  <ClipboardList size={16} /> This business
                </Button>
                {activePage === "inventory" && (
                  <Button onClick={() => setShowProductForm(true)}>
                    <Plus size={17} /> Add product
                  </Button>
                )}
              </div>
            </div>

            {activePage === "dashboard" ? (
              <>
                <section className="metric-grid" aria-label="Business summary">
                  <Metric
                    title="Sales recorded"
                    value={String(salesCount)}
                    icon={<ShoppingBag />}
                    hint="Completed transactions"
                    trend="neutral"
                  />
                  <Metric
                    title="Revenue recorded"
                    value={formatKes(revenue)}
                    icon={<Wallet />}
                    hint="From completed sales"
                    trend="neutral"
                  />
                  <Metric
                    title="Stock at cost"
                    value={formatKes(stockValue)}
                    icon={<Boxes />}
                    hint={`${products.length} active products`}
                    trend="neutral"
                  />
                  <Metric
                    title="Needs attention"
                    value={String(lowStockCount)}
                    icon={<ArrowDownRight />}
                    hint="Products at or below minimum"
                    trend={lowStockCount > 0 ? "warning" : "good"}
                  />
                </section>
                <section className="dashboard-grid">
                  <div className="data-section sales-overview">
                    <div className="section-heading">
                      <div>
                        <h2>Sales overview</h2>
                        <p>Completed sales in this business</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View reports"
                        onClick={() => toast.info("Reports are next in the build roadmap.")}
                      >
                        <BarChart3 />
                      </Button>
                    </div>
                    <div className="sales-empty">
                      <div className="empty-chart-icon">
                        <BarChart3 size={20} />
                      </div>
                      {salesCount === 0 ? (
                        <>
                          <b>No sales recorded yet</b>
                          <span>Your completed sales will appear here.</span>
                        </>
                      ) : (
                        <>
                          <b>{formatKes(revenue)} total recorded</b>
                          <span>
                            {salesCount} completed {salesCount === 1 ? "sale" : "sales"} in your
                            records.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="data-section stock-section">
                    <div className="section-heading">
                      <div>
                        <h2>Stock watch</h2>
                        <p>Low stock at a glance</p>
                      </div>
                      <button className="text-action" onClick={() => setActivePage("inventory")}>
                        See inventory <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {products
                      .filter(
                        (product) =>
                          (product.inventory?.quantity_on_hand ?? 0) <= product.low_stock_threshold,
                      )
                      .slice(0, 4)
                      .map((product) => (
                        <StockRow key={product.id} product={product} />
                      ))}
                    {lowStockCount === 0 ? (
                      <div className="stock-empty">
                        <Check size={17} /> All products are above their minimum stock.
                      </div>
                    ) : null}
                  </div>
                </section>
                <section className="data-section activity-section">
                  <div className="section-heading">
                    <div>
                      <h2>Inventory overview</h2>
                      <p>Your products, ready to sell</p>
                    </div>
                    <button className="text-action" onClick={() => setActivePage("inventory")}>
                      View inventory <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <ProductTable
                    products={products.slice(0, 5)}
                    currency={activeBusiness.currency}
                    onAdjust={setShowStockForm}
                    onAdd={() => setShowProductForm(true)}
                  />
                </section>
                <div className="dashboard-footnote">
                  <ShieldCheck size={15} /> Your business data is private to your team.
                </div>
              </>
            ) : (
              <>
                <section className="inventory-metrics">
                  <div>
                    <span>Active products</span>
                    <b>{products.length}</b>
                  </div>
                  <div>
                    <span>Stock at cost</span>
                    <b>{formatKes(stockValue)}</b>
                  </div>
                  <div>
                    <span>Low stock</span>
                    <b className={lowStockCount ? "warning-value" : ""}>{lowStockCount}</b>
                  </div>
                  <div>
                    <span>Customers</span>
                    <b>{customersCount}</b>
                  </div>
                </section>
                <section className="data-section inventory-table-section">
                  <div className="table-toolbar">
                    <div>
                      <h2>Product catalogue</h2>
                      <p>
                        {products.length} products · {activeBusiness.currency}
                      </p>
                    </div>
                    <div className="table-controls">
                      <label className="search-box">
                        <Search size={17} />
                        <Input
                          aria-label="Search products"
                          placeholder="Search products or SKU"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                        />
                      </label>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Filter products"
                        aria-label="Filter products"
                        onClick={() =>
                          toast.info(
                            "Use search to find products by name, SKU, barcode, or category.",
                          )
                        }
                      >
                        <SlidersHorizontal size={17} />
                      </Button>
                      <Button onClick={() => setShowProductForm(true)}>
                        <Plus size={17} />
                        <span className="add-product-label">Add product</span>
                      </Button>
                    </div>
                  </div>
                  <ProductTable
                    products={filteredProducts}
                    currency={activeBusiness.currency}
                    onAdjust={setShowStockForm}
                    onAdd={() => setShowProductForm(true)}
                    loading={loading}
                    full
                  />
                </section>
                <section className="data-section category-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Categories</h2>
                      <p>Organise your catalogue</p>
                    </div>
                  </div>
                  <form className="category-form" onSubmit={createCategory}>
                    <Input
                      name="categoryName"
                      placeholder="Category name"
                      aria-label="Category name"
                      required
                    />
                    <Button type="submit" variant="outline">
                      <Plus size={16} /> Add category
                    </Button>
                  </form>
                  <div className="category-tags">
                    {categories.map((category) => (
                      <span key={category.id}>{category.name}</span>
                    ))}
                    {categories.length === 0 && <small>No categories yet.</small>}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {showBusinessForm && (
        <Modal
          title="Set up your business"
          description="Your business records will be kept separate from other businesses."
          onClose={() => setShowBusinessForm(false)}
        >
          <form className="form-stack" onSubmit={createBusiness}>
            <label>
              Business name
              <Input name="businessName" placeholder="e.g. Acacia Market" required autoFocus />
            </label>
            <div className="form-note">
              <ShieldCheck size={16} /> Currency is set to Kenyan shillings (KES).
            </div>
            <Button type="submit" className="w-full">
              <Building2 size={17} /> Create business
            </Button>
          </form>
        </Modal>
      )}
      {showProductForm && activeBusiness && (
        <Modal
          title="Add a product"
          description="Add a real product and its opening stock."
          onClose={() => setShowProductForm(false)}
        >
          <form className="form-stack" onSubmit={createProduct}>
            <div className="form-two">
              <label>
                Product name
                <Input name="name" placeholder="e.g. Maize flour 2 kg" required autoFocus />
              </label>
              <label>
                SKU
                <Input name="sku" placeholder="e.g. MF-002" required />
              </label>
            </div>
            <div className="form-two">
              <label>
                Barcode <span className="optional-label">Optional</span>
                <Input name="barcode" placeholder="Scan or enter barcode" />
              </label>
              <label>
                Category
                <select name="categoryId" defaultValue="" className="form-select">
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-two">
              <label>
                Cost price (KES)
                <Input
                  name="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
              <label>
                Selling price (KES)
                <Input
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
            </div>
            <div className="form-two">
              <label>
                Opening stock
                <Input
                  name="initialStock"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue="0"
                  required
                />
              </label>
              <label>
                Low stock alert at
                <Input
                  name="threshold"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue="5"
                  required
                />
              </label>
            </div>
            <div className="form-note">
              <ShieldCheck size={16} /> Prices and opening stock cannot be negative.
            </div>
            <Button type="submit" className="w-full">
              <PackagePlus size={17} /> Save product
            </Button>
          </form>
        </Modal>
      )}
      {showStockForm && (
        <Modal
          title="Adjust stock"
          description={`${showStockForm.name} · ${showStockForm.sku}`}
          onClose={() => setShowStockForm(null)}
        >
          <form className="form-stack" onSubmit={adjustStock}>
            <div className="current-stock">
              <span>Current stock</span>
              <b>{formatQuantity(showStockForm.inventory?.quantity_on_hand ?? 0)}</b>
            </div>
            <label>
              Adjustment <span className="optional-label">Use a minus sign to remove stock</span>
              <Input
                name="quantity"
                type="number"
                step="0.001"
                placeholder="e.g. 12 or -2"
                required
                autoFocus
              />
            </label>
            <label>
              Reason
              <Input name="reason" placeholder="e.g. New delivery, damaged goods" required />
            </label>
            <div className="form-note">
              <ClipboardList size={16} /> Every change is added to the stock history.
            </div>
            <Button type="submit" className="w-full">
              Save adjustment
            </Button>
          </form>
        </Modal>
      )}
      <div className="mobile-nav lg:hidden">
        <button
          className={activePage === "dashboard" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setActivePage("dashboard")}
        >
          <LayoutDashboard size={19} />
          Overview
        </button>
        <button
          className={activePage === "inventory" ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={() => setActivePage("inventory")}
        >
          <Boxes size={19} />
          Inventory
        </button>
        <button
          className="mobile-nav-item"
          onClick={() => toast.info("Sales and checkout are next in the build roadmap.")}
        >
          <ShoppingCart size={19} />
          Checkout
        </button>
        <button
          className="mobile-nav-item"
          onClick={() => toast.info("Customer records are next in the build roadmap.")}
        >
          <Users size={19} />
          Customers
        </button>
      </div>
    </div>
  );
}

function SignInScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  busy,
  confirmation,
  onSubmit,
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  busy: boolean;
  confirmation: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">
          <Boxes size={21} strokeWidth={2.3} />
        </div>
        <span>
          Kioo<span className="brand-light">POS</span>
        </span>
      </div>
      <div className="auth-layout">
        <div className="auth-story">
          <div className="story-orbit orbit-one" />
          <div className="story-orbit orbit-two" />
          <div className="story-content">
            <div className="story-kicker">
              <span className="story-kicker-dot" /> MADE FOR YOUR BUSINESS
            </div>
            <h1>
              Make every
              <br />
              business day
              <br />
              <em>count.</em>
            </h1>
            <p>Your stock, sales, and business insights — in one clear view.</p>
            <div className="story-stat-row">
              <div className="story-stat">
                <span>01</span>
                <b>Know your stock</b>
              </div>
              <div className="story-stat">
                <span>02</span>
                <b>See the full picture</b>
              </div>
              <div className="story-stat">
                <span>03</span>
                <b>Keep moving forward</b>
              </div>
            </div>
            <div className="story-symbol">
              <Boxes size={108} strokeWidth={0.65} />
            </div>
          </div>
        </div>
        <section className="auth-panel">
          <div className="auth-panel-top">
            <span className="auth-step">{mode === "signup" ? "GET STARTED" : "WELCOME BACK"}</span>
            <span className="secure-note">
              <ShieldCheck size={15} /> Secure sign-in
            </span>
          </div>
          <h2>{mode === "signup" ? "Start with Kioo." : "Good to see you."}</h2>
          <p className="auth-description">
            {mode === "signup"
              ? "Create an account to set up your business."
              : "Sign in to see how your business is doing."}
          </p>
          {confirmation ? (
            <div className="confirmation-panel">
              <div className="confirmation-icon">
                <Check size={21} />
              </div>
              <b>Check your email</b>
              <p>
                We sent a confirmation link to <strong>{email}</strong>. Confirm your address, then
                sign in.
              </p>
              <Button variant="outline" onClick={() => setMode("signin")}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <form className="auth-form" onSubmit={onSubmit}>
                {mode === "signup" && (
                  <label>
                    Your name
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="How should we address you?"
                      autoComplete="name"
                      required
                    />
                  </label>
                )}
                <label>
                  Email address
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                  />
                </label>
                <Button type="submit" disabled={busy} className="auth-submit">
                  {busy ? <LoaderCircle size={17} className="animate-spin" /> : null}
                  {mode === "signup" ? "Create your account" : "Sign in"}
                  <ArrowUpRight size={17} />
                </Button>
              </form>
              <p className="auth-toggle">
                {mode === "signup" ? "Already have an account?" : "New to Kioo?"}
                <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </button>
              </p>
              <p className="auth-legal">
                By continuing, you agree to use Kioo POS responsibly for your business.
              </p>
            </>
          )}
        </section>
      </div>
      <div className="auth-footer">
        <span>© {new Date().getFullYear()} Kioo POS</span>
        <span>Thoughtful tools for everyday business.</span>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  icon,
  hint,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  hint: string;
  trend: "neutral" | "good" | "warning";
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{title}</span>
        <span className={`metric-icon ${trend}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-hint">{hint}</span>
    </div>
  );
}

function StockRow({ product }: { product: Product }) {
  const quantity = product.inventory?.quantity_on_hand ?? 0;
  return (
    <div className="stock-row">
      <div className="product-initial">{product.name.slice(0, 1).toUpperCase()}</div>
      <div className="stock-product-name">
        <b>{product.name}</b>
        <span>{product.sku}</span>
      </div>
      <span className={quantity <= 0 ? "stock-pill out" : "stock-pill low"}>
        {formatQuantity(quantity)} left
      </span>
    </div>
  );
}

function ProductTable({
  products,
  currency,
  onAdjust,
  onAdd,
  loading = false,
  full = false,
}: {
  products: Product[];
  currency: string;
  onAdjust: (product: Product) => void;
  onAdd: () => void;
  loading?: boolean;
  full?: boolean;
}) {
  if (loading)
    return (
      <div className="table-empty">
        <LoaderCircle className="animate-spin" size={22} /> Loading products…
      </div>
    );
  if (!products.length)
    return (
      <div className="table-empty">
        <div className="empty-box">
          <Boxes size={21} />
        </div>
        <b>{full ? "No matching products" : "No products yet"}</b>
        <span>
          {full ? "Try a different search." : "Add products to see your stock at a glance."}
        </span>
        {full && products.length === 0 && (
          <Button size="sm" onClick={onAdd}>
            <Plus size={15} /> Add product
          </Button>
        )}
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="product-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>SKU</th>
            {full && <th>CATEGORY</th>}
            <th>IN STOCK</th>
            <th>SELLING PRICE</th>
            {full && <th>COST PRICE</th>}
            <th>STATUS</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const quantity = product.inventory?.quantity_on_hand ?? 0;
            const isLow = quantity <= product.low_stock_threshold;
            return (
              <tr key={product.id}>
                <td>
                  <div className="product-cell">
                    <div className="table-product-icon">
                      <ShoppingBag size={16} />
                    </div>
                    <span>{product.name}</span>
                  </div>
                </td>
                <td className="sku-cell">{product.sku}</td>
                {full && <td>{product.category}</td>}
                <td>
                  <span className="quantity-cell">
                    {formatQuantity(quantity)} <small>units</small>
                  </span>
                </td>
                <td className="price-cell">
                  {currency}{" "}
                  {Number(product.selling_price).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {full && (
                  <td className="price-cell">
                    {currency}{" "}
                    {Number(product.cost_price).toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                )}
                <td>
                  <span className={isLow ? "status-pill low-status" : "status-pill in-stock"}>
                    <span />
                    {quantity <= 0 ? "Out of stock" : isLow ? "Low stock" : "In stock"}
                  </span>
                </td>
                <td>
                  <button
                    className="row-action"
                    title={`Adjust stock for ${product.name}`}
                    aria-label={`Adjust stock for ${product.name}`}
                    onClick={() => onAdjust(product)}
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={19} />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

function formatKes(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function formatQuantity(value: number) {
  return Number(value).toLocaleString("en-KE", { maximumFractionDigits: 3 });
}
