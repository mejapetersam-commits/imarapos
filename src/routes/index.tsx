import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient, authConfigured, getToken } from "@/auth";
import {
  adjustStock as adjustStockFn,
  createBusiness as createBusinessFn,
  createCategory as createCategoryFn,
  createProduct as createProductFn,
  acceptInvite as acceptInviteFn,
  createInvite as createInviteFn,
  createSupplier as createSupplierFn,
  loadTeam as loadTeamFn,
  previewInvite,
  revokeInvite as revokeInviteFn,
  updateMember as updateMemberFn,
  type PendingInvite,
  type TeamMember,
  deleteSupplier as deleteSupplierFn,
  updateProduct as updateProductFn,
  updateSupplier as updateSupplierFn,
  createSale as createSaleFn,
  getReceipt as getReceiptFn,
  listBusinesses,
  listSales as listSalesFn,
  loadBusinessData as loadBusinessDataFn,
  refundSale as refundSaleFn,
  type Receipt,
  type Result,
  type SaleListRow,
} from "@/api/functions";
import type { CartLine } from "@/lib/cart";
import { POS } from "@/components/pos/POS";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { Sales } from "@/components/pos/Sales";
import { isValidNewProduct, isValidStockAdjustment } from "@/lib/pos-rules";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pos/AppShell";
import { AuthScreen } from "@/components/pos/AuthScreen";
import { Dashboard } from "@/components/pos/Dashboard";
import {
  BusinessForm,
  CategoryForm,
  InviteForm,
  InviteLinkDialog,
  JoinInviteDialog,
  ProductForm,
  StockForm,
  SupplierForm,
} from "@/components/pos/Forms";
import { Inventory } from "@/components/pos/Inventory";
import { Suppliers } from "@/components/pos/Suppliers";
import { Team } from "@/components/pos/Team";
import type {
  AuthMode,
  Business,
  Category,
  Page,
  Product,
  Role,
  Supplier,
} from "@/components/pos/types";

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
  const [sales, setSales] = useState<SaleListRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState<Supplier | "new" | null>(null);
  const [role, setRole] = useState<Role>("cashier");
  const [team, setTeam] = useState<{
    members: TeamMember[];
    invites: PendingInvite[];
    me: string;
  } | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string } | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [joinInvite, setJoinInvite] = useState<{
    business_name: string;
    role: string;
    email: string;
  } | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
      setSuppliers([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeBusiness) void loadBusinessData(activeBusiness);
  }, [activeBusiness?.id]);

  useEffect(() => {
    // Invite and password-reset links arrive as query parameters; keep them, then clean the URL.
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const reset = params.get("token");
    try {
      if (invite) sessionStorage.setItem("imarapos_invite", invite);
      setPendingInvite(sessionStorage.getItem("imarapos_invite"));
    } catch {
      setPendingInvite(invite);
    }
    if (reset) {
      setResetToken(reset);
      setAuthMode("reset");
    }
    if (params.get("error"))
      toast.error("That reset link is invalid or has expired. Request a new one.");
    if (invite || reset || params.get("error"))
      window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!user || !pendingInvite) return;
    void (async () => {
      const preview = await api((token) =>
        previewInvite({ data: { token, inviteToken: pendingInvite } }),
      );
      if (preview) setJoinInvite(preview);
      else clearInvite();
    })();
  }, [user?.id, pendingInvite]);

  useEffect(() => {
    if (activePage === "team" && activeBusiness && (role === "owner" || role === "manager"))
      void loadTeamData(activeBusiness);
  }, [activePage, activeBusiness?.id, role]);

  useEffect(() => {
    if (activePage === "sales" && activeBusiness) void loadSales(activeBusiness);
  }, [activePage, activeBusiness?.id]);

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

  async function loadBusinesses(selectId?: string) {
    setLoadError(false);
    const rows = await api((token) => listBusinesses({ data: { token } }));
    if (!rows) {
      setLoadError(true);
      return;
    }
    setBusinesses(rows);
    setActiveBusiness(
      (current) =>
        rows.find((business) => business.id === (selectId ?? current?.id)) ?? rows[0] ?? null,
    );
    if (!rows.length && !hasPendingInvite()) setShowBusinessForm(true);
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
          supplier_id: row.supplier_id,
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
      setSuppliers(result.suppliers);
      setRole(result.role);
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
    setResetSent(false);
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
    try {
      if (authMode === "forgot") {
        const { error } = await Promise.race([
          authClient.requestPasswordReset({
            email: authEmail,
            redirectTo: `${window.location.origin}/`,
          }),
          timeout,
        ]);
        if (error) toast.error(error.message ?? "Could not send the reset link.");
        else setResetSent(true);
        return;
      }
      if (authMode === "reset") {
        const { error } = await Promise.race([
          authClient.resetPassword({ newPassword: authPassword, token: resetToken ?? "" }),
          timeout,
        ]);
        if (error) {
          toast.error(error.message ?? "That reset link is invalid or has expired.");
        } else {
          toast.success("Password updated. Sign in with your new password.");
          setResetToken(null);
          setAuthPassword("");
          setAuthMode("signin");
        }
        return;
      }
      const request =
        authMode === "signup"
          ? authClient.signUp.email({
              email: authEmail,
              password: authPassword,
              name: authName.trim(),
            })
          : authClient.signIn.email({ email: authEmail, password: authPassword });
      const { data, error } = await Promise.race([request, timeout]);
      if (error) toast.error(error.message ?? "Could not complete that request.");
      else if (authMode === "signup" && !(data as { token?: string | null } | null)?.token) {
        const signedIn = await authClient.signIn.email({
          email: authEmail,
          password: authPassword,
        });
        if (signedIn.error) setNeedsEmailConfirmation(true);
        else toast.success("Your account is ready.");
      } else toast.success(authMode === "signup" ? "Your account is ready." : "Welcome back.");
    } catch (error) {
      console.error("Auth request failed", error);
      toast.error(error instanceof Error ? error.message : "Could not reach the sign-in service.");
    } finally {
      setAuthBusy(false);
    }
  }

  /** Runs a save once at a time, so a double-click can never submit twice. */
  async function guarded(task: () => Promise<void>) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await task();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
  const optional = (form: FormData, key: string) => text(form, key) || null;

  async function createBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const name = text(new FormData(event.currentTarget), "businessName");
    if (!name) return;
    await guarded(async () => {
      const business = await api((token) => createBusinessFn({ data: { token, name } }));
      if (!business) return;
      setBusinesses((current) => [...current, business]);
      setActiveBusiness(business);
      setShowBusinessForm(false);
      toast.success("Business created.");
    });
  }

  function readProduct(form: FormData) {
    return {
      name: text(form, "name"),
      sku: text(form, "sku"),
      barcode: text(form, "barcode"),
      category_id: text(form, "categoryId") || null,
      supplier_id: text(form, "supplierId") || null,
      cost_price: Number(form.get("costPrice")),
      selling_price: Number(form.get("sellingPrice")),
      low_stock_threshold: Number(form.get("threshold")),
      initial_stock: Number(form.get("initialStock") ?? 0),
    };
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness) return;
    const product = readProduct(new FormData(event.currentTarget));
    if (!isValidNewProduct(product)) {
      toast.error("Check the product details and enter zero or higher for prices and stock.");
      return;
    }
    await guarded(async () => {
      const id = await api((token) =>
        createProductFn({
          data: {
            token,
            businessId: activeBusiness.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode || null,
            categoryId: product.category_id,
            supplierId: product.supplier_id,
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
    });
  }

  async function updateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness || !editingProduct) return;
    const form = new FormData(event.currentTarget);
    const product = { ...readProduct(form), initial_stock: 0 };
    if (!isValidNewProduct(product)) {
      toast.error("Check the product details and enter zero or higher for prices.");
      return;
    }
    const target = editingProduct;
    await guarded(async () => {
      const done = await api((token) =>
        updateProductFn({
          data: {
            token,
            businessId: activeBusiness.id,
            productId: target.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode || null,
            categoryId: product.category_id,
            supplierId: product.supplier_id,
            costPrice: product.cost_price,
            sellingPrice: product.selling_price,
            lowStockThreshold: product.low_stock_threshold,
            active: form.get("active") === "on",
          },
        }),
      );
      if (!done) return;
      setEditingProduct(null);
      toast.success("Product updated.");
      await loadBusinessData(activeBusiness);
    });
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
    const note = text(form, "reason") || "Manual adjustment";
    const target = showStockForm;
    await guarded(async () => {
      const quantity = await api((token) =>
        adjustStockFn({
          data: { token, businessId: activeBusiness.id, productId: target.id, delta, note },
        }),
      );
      if (quantity === null) return;
      setShowStockForm(null);
      toast.success("Stock updated.");
      await loadBusinessData(activeBusiness);
    });
  }

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness) return;
    const formElement = event.currentTarget;
    const name = text(new FormData(formElement), "categoryName");
    if (!name) return;
    await guarded(async () => {
      const category = await api((token) =>
        createCategoryFn({ data: { token, businessId: activeBusiness.id, name } }),
      );
      if (!category) return;
      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      );
      formElement.reset();
      toast.success("Category added.");
    });
  }

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness || !supplierForm) return;
    const form = new FormData(event.currentTarget);
    const fields = {
      name: text(form, "name"),
      phone: optional(form, "phone"),
      email: optional(form, "email"),
      address: optional(form, "address"),
      notes: optional(form, "notes"),
    };
    if (!fields.name) return;
    const existing = supplierForm === "new" ? null : supplierForm;
    await guarded(async () => {
      const done = existing
        ? await api((token) =>
            updateSupplierFn({
              data: { token, businessId: activeBusiness.id, supplierId: existing.id, ...fields },
            }),
          )
        : await api((token) =>
            createSupplierFn({ data: { token, businessId: activeBusiness.id, ...fields } }),
          );
      if (!done) return;
      setSupplierForm(null);
      toast.success(existing ? "Supplier updated." : "Supplier added.");
      await loadBusinessData(activeBusiness);
    });
  }

  async function removeSupplier(supplier: Supplier) {
    if (!activeBusiness || !window.confirm(`Delete ${supplier.name}? This cannot be undone.`))
      return;
    await guarded(async () => {
      const done = await api((token) =>
        deleteSupplierFn({
          data: { token, businessId: activeBusiness.id, supplierId: supplier.id },
        }),
      );
      if (!done) return;
      toast.success("Supplier deleted.");
      await loadBusinessData(activeBusiness);
    });
  }

  function hasPendingInvite() {
    try {
      return Boolean(sessionStorage.getItem("imarapos_invite"));
    } catch {
      return false;
    }
  }

  function clearInvite() {
    try {
      sessionStorage.removeItem("imarapos_invite");
    } catch {
      /* storage unavailable */
    }
    setPendingInvite(null);
    setJoinInvite(null);
  }

  async function acceptInviteNow() {
    const inviteToken = pendingInvite;
    if (!inviteToken) return;
    await guarded(async () => {
      const businessId = await api((token) => acceptInviteFn({ data: { token, inviteToken } }));
      clearInvite();
      if (!businessId) return;
      setShowBusinessForm(false);
      toast.success("You’ve joined the business.");
      await loadBusinesses(businessId);
    });
  }

  async function loadTeamData(business: Business) {
    setTeamLoading(true);
    const result = await api((token) => loadTeamFn({ data: { token, businessId: business.id } }));
    if (result) setTeam(result);
    setTeamLoading(false);
  }

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBusiness) return;
    const form = new FormData(event.currentTarget);
    const email = text(form, "email").toLowerCase();
    const inviteRole = text(form, "role") === "manager" ? "manager" : "cashier";
    await guarded(async () => {
      const secret = await api((token) =>
        createInviteFn({ data: { token, businessId: activeBusiness.id, email, role: inviteRole } }),
      );
      if (!secret) return;
      setShowInviteForm(false);
      setInviteLink({ link: `${window.location.origin}/?invite=${secret}`, email });
      await loadTeamData(activeBusiness);
    });
  }

  async function revokeInvite(invite: PendingInvite) {
    if (!activeBusiness || !window.confirm(`Revoke the invite for ${invite.email}?`)) return;
    await guarded(async () => {
      const done = await api((token) =>
        revokeInviteFn({ data: { token, businessId: activeBusiness.id, inviteId: invite.id } }),
      );
      if (done) await loadTeamData(activeBusiness);
    });
  }

  async function changeMember(member: TeamMember, nextRole: Role, active: boolean) {
    if (!activeBusiness) return;
    await guarded(async () => {
      const done = await api((token) =>
        updateMemberFn({
          data: {
            token,
            businessId: activeBusiness.id,
            userId: member.user_id,
            role: nextRole,
            active,
          },
        }),
      );
      if (done) toast.success("Team updated.");
      await loadTeamData(activeBusiness);
    });
  }

  function toggleMember(member: TeamMember) {
    if (
      member.active &&
      !window.confirm(
        `Deactivate ${member.name || member.email}? They will lose access to this business.`,
      )
    )
      return;
    void changeMember(member, member.role, !member.active);
  }

  async function loadSales(business: Business) {
    setSalesLoading(true);
    const rows = await api((token) => listSalesFn({ data: { token, businessId: business.id } }));
    if (rows) setSales(rows);
    setSalesLoading(false);
  }

  async function openReceipt(saleId: string) {
    if (!activeBusiness) return;
    const found = await api((token) =>
      getReceiptFn({ data: { token, businessId: activeBusiness.id, saleId } }),
    );
    if (found) setReceipt(found);
  }

  /** Records a cash sale. Returns true when it was saved; the cart is only cleared then, so a failure can be retried safely. */
  async function completeSale(sale: {
    clientUuid: string;
    lines: CartLine[];
    discount: number;
    cashTendered: number;
  }) {
    if (!activeBusiness) return false;
    let saved = false;
    await guarded(async () => {
      const saleId = await api((token) =>
        createSaleFn({
          data: {
            token,
            businessId: activeBusiness.id,
            clientUuid: sale.clientUuid,
            items: sale.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
            discount: sale.discount,
            cashTendered: sale.cashTendered,
          },
        }),
      );
      if (!saleId) return;
      saved = true;
      toast.success("Sale completed.");
      await loadBusinessData(activeBusiness);
      await openReceipt(saleId);
    });
    return saved;
  }

  async function refundReceipt(items: { saleItemId: string; quantity: number }[], reason: string) {
    if (!activeBusiness || !receipt) return;
    const saleId = receipt.sale.id;
    await guarded(async () => {
      const amount = await api((token) =>
        refundSaleFn({ data: { token, businessId: activeBusiness.id, saleId, items, reason } }),
      );
      if (amount === null) return;
      toast.success(`Refund recorded: KES ${amount.toLocaleString("en-KE")}`);
      await loadBusinessData(activeBusiness);
      await loadSales(activeBusiness);
      await openReceipt(saleId);
    });
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
  if (!user || resetToken)
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
        confirmation={needsEmailConfirmation ? "verify" : resetSent ? "reset" : null}
        invite={
          pendingInvite
            ? "You’ve been invited to join a business. Sign in or create an account with the email address the invite was sent to."
            : null
        }
        onForgot={() => {
          setAuthPassword("");
          setAuthMode("forgot");
        }}
        onBack={() => {
          setNeedsEmailConfirmation(false);
          setResetSent(false);
          setResetToken(null);
          setAuthMode("signin");
        }}
        onSubmit={handleAuthSubmit}
      />
    );

  const canManage = role === "owner" || role === "manager";
  const activeProducts = products.filter((product) => product.active);

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
      canManage={canManage}
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
          products={activeProducts}
          revenue={revenue}
          salesCount={salesCount}
          customersCount={customersCount}
          categoriesCount={categories.length}
          loading={loading}
          canManage={canManage}
          onAddProduct={() => setShowProductForm(true)}
          onOpenInventory={() => setActivePage("inventory")}
        />
      ) : activePage === "pos" ? (
        <POS
          products={activeProducts}
          loading={loading}
          saving={saving}
          onComplete={completeSale}
        />
      ) : activePage === "sales" ? (
        <Sales
          sales={sales}
          loading={salesLoading}
          ownOnly={role === "cashier"}
          onOpen={(id) => void openReceipt(id)}
        />
      ) : activePage === "team" && canManage ? (
        <Team
          members={team?.members ?? []}
          invites={team?.invites ?? []}
          me={team?.me ?? ""}
          loading={teamLoading && !team}
          isOwner={role === "owner"}
          onInvite={() => setShowInviteForm(true)}
          onRevoke={revokeInvite}
          onChangeRole={(member, next) => void changeMember(member, next, member.active)}
          onToggleActive={toggleMember}
        />
      ) : activePage === "suppliers" ? (
        <Suppliers
          suppliers={suppliers}
          loading={loading}
          canManage={canManage}
          onAdd={() => setSupplierForm("new")}
          onEdit={setSupplierForm}
          onDelete={removeSupplier}
        />
      ) : (
        <Inventory
          products={products}
          categories={categories}
          loading={loading}
          canManage={canManage}
          onAddProduct={() => setShowProductForm(true)}
          onAddCategory={() => setShowCategoryForm(true)}
          onAdjust={setShowStockForm}
          onEdit={setEditingProduct}
        />
      )}
      {showBusinessForm && (
        <BusinessForm
          saving={saving}
          onSubmit={createBusiness}
          onCancel={() => setShowBusinessForm(false)}
          canCancel={businesses.length > 0}
        />
      )}
      {showCategoryForm && (
        <CategoryForm
          categories={categories}
          saving={saving}
          onSubmit={createCategory}
          onClose={() => setShowCategoryForm(false)}
        />
      )}
      {showProductForm && (
        <ProductForm
          categories={categories}
          suppliers={suppliers}
          saving={saving}
          onSubmit={createProduct}
          onClose={() => setShowProductForm(false)}
        />
      )}
      {editingProduct && (
        <ProductForm
          product={editingProduct}
          categories={categories}
          suppliers={suppliers}
          saving={saving}
          onSubmit={updateProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
      {receipt && (
        <ReceiptDialog
          receipt={receipt}
          canRefund={canManage}
          saving={saving}
          onRefund={refundReceipt}
          onClose={() => setReceipt(null)}
        />
      )}
      {showStockForm && (
        <StockForm
          product={showStockForm}
          saving={saving}
          onSubmit={adjustStock}
          onClose={() => setShowStockForm(null)}
        />
      )}
      {showInviteForm && (
        <InviteForm
          saving={saving}
          onSubmit={sendInvite}
          onClose={() => setShowInviteForm(false)}
        />
      )}
      {inviteLink && (
        <InviteLinkDialog
          link={inviteLink.link}
          email={inviteLink.email}
          onClose={() => setInviteLink(null)}
        />
      )}
      {joinInvite && (
        <JoinInviteDialog
          business={joinInvite.business_name}
          role={joinInvite.role}
          saving={saving}
          onAccept={() => void acceptInviteNow()}
          onDecline={clearInvite}
        />
      )}
      {supplierForm && (
        <SupplierForm
          supplier={supplierForm === "new" ? null : supplierForm}
          saving={saving}
          onSubmit={saveSupplier}
          onClose={() => setSupplierForm(null)}
        />
      )}
    </AppShell>
  );
}
