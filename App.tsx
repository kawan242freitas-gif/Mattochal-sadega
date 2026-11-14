import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Image,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight, Copy, House, Minus, Plus, Search, ShoppingBag, ShoppingCart, Settings, Trash2, X } from "lucide-react-native";

type PanelName = "search" | "cart" | "settings" | null;
type ProductCategory = "adega" | "frigobar";
type CategoryFilter = "todos" | ProductCategory;
type Product = { id: string; name: string; label: string; price: string; promotionalPrice?: string; stockQuantity?: number; description: string; tone: string; category: ProductCategory; imageUrl?: string };
type OrderView = {
  id: string;
  customerName: string;
  chaletNumber: string;
  items: { productId: string; name: string; label: string; quantity: number; unitPrice: number; tone: string; imageUrl?: string }[];
  subtotal: number;
  notes: string;
  status: "awaiting_proof" | "uploading_proof" | "proof_submitted" | "confirmed";
  proof?: { name: string; dataUrl?: string; url?: string; storage?: "fivemanage" | "mongodb"; uploadedAt: string };
  createdAt: string;
};

const HERO_IMAGE_URL = "https://r2.fivemanage.com/vLUsF9vzqBOo7DSFHERFX/CestadeVinhosMattoChals.png";
const CART_STORAGE_KEY = "matto-chales-cart-v1";
const PIX_KEY = "matto.corporativo@gmail.com";
const WHATSAPP_NUMBER = "553187952587";

function parsePrice(value?: string) {
  if (!value || value.toLocaleLowerCase().includes("consulte")) return null;
  const normalized = value.replace(/[^\d,.-]/g, "");
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const price = Number(decimal);
  return Number.isFinite(price) ? price : null;
}

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function effectivePrice(product?: Product) {
  return parsePrice(product?.promotionalPrice || product?.price);
}

const navItems = [
  { id: "home", label: "Início", Icon: House },
  { id: "search", label: "Buscar", Icon: Search },
  { id: "cart", label: "Carrinho", Icon: ShoppingCart },
  { id: "settings", label: "Configurações", Icon: Settings },
] as const;

const productCategoryFilters: { id: CategoryFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "adega", label: "Adega" },
  { id: "frigobar", label: "Frigobar" },
];

const webGlassStyle = Platform.OS === "web"
  ? ({
      backgroundColor: "rgba(27, 19, 14, 0.76)",
      backdropFilter: "blur(22px) saturate(150%)",
      WebkitBackdropFilter: "blur(22px) saturate(150%)",
    } as ViewStyle)
  : undefined;

function BodyCopy({ children = "...", style, numberOfLines }: { children?: React.ReactNode; style?: object; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[styles.bodyCopy, style]}>{children}</Text>;
}

function WineBottle({ tone = "ivory", small = false }: { tone?: string; small?: boolean }) {
  return (
    <View style={[styles.bottle, small && styles.bottleSmall]}>
      <View style={[styles.bottleNeck, small && styles.bottleNeckSmall]} />
      <View style={[styles.bottleLabel, tone === "gold" && styles.labelGold, tone === "olive" && styles.labelOlive]} />
    </View>
  );
}

function SectionTitle({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionRule, compact && styles.sectionRuleMobile]} />
      <Text style={[styles.sectionTitle, compact && styles.sectionTitleMobile]}>{children}</Text>
    </View>
  );
}

function App() {
  return <SafeAreaProvider><SiteScreen /></SafeAreaProvider>;
}

function SiteScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const productsScrollRef = useRef<ScrollView>(null);
  const productScrollPosition = useRef(0);
  const productScrollWidth = useRef(0);
  const productViewportWidth = useRef(0);
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth <= 680;
  const isSmallMobile = viewportWidth <= 390;
  const [panel, setPanel] = useState<PanelName>(null);
  const [active, setActive] = useState("home");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [cartHydrated, setCartHydrated] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutChalet, setCheckoutChalet] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderView | null>(null);
  const [orderToken, setOrderToken] = useState("");
  const [orderViewMode, setOrderViewMode] = useState<"payment" | "final">("payment");
  const [orderLoading, setOrderLoading] = useState(false);
  const [receiptDataUrl, setReceiptDataUrl] = useState("");
  const [receiptFileName, setReceiptFileName] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [databaseMode, setDatabaseMode] = useState<"checking" | "local" | "connected">("checking");
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [productCategory, setProductCategory] = useState<ProductCategory>("adega");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todos");
  const [productPrice, setProductPrice] = useState("");
  const [productPromotionalPrice, setProductPromotionalPrice] = useState("");
  const [productStockQuantity, setProductStockQuantity] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productTone, setProductTone] = useState("ivory");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productFormError, setProductFormError] = useState("");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      setCartHydrated(true);
      return;
    }

    try {
      const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as { items?: Record<string, unknown>; notes?: unknown };
        const validItems = Object.fromEntries(
          Object.entries(parsed.items ?? {}).filter((entry): entry is [string, number] =>
            typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] > 0,
          ),
        );
        setCart(validItems);
        if (typeof parsed.notes === "string") setOrderNotes(parsed.notes);
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setCartHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!cartHydrated || Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: cart, notes: orderNotes }));
    } catch {
      // O carrinho continua disponível na sessão atual se o navegador bloquear o armazenamento local.
    }
  }, [cart, orderNotes, cartHydrated]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const parameters = new URLSearchParams(window.location.search);
    const isFinalOrder = parameters.has("pedido");
    const token = parameters.get(isFinalOrder ? "pedido" : "comanda");
    if (!token) return;
    setOrderViewMode(isFinalOrder ? "final" : "payment");
    setOrderToken(token);
    setOrderLoading(true);
    fetch(`/api/orders?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as OrderView | { error?: string };
        if (!response.ok || "error" in result) throw new Error("Não foi possível abrir esta comanda.");
        setCurrentOrder(result);
      })
      .catch((error) => setCheckoutError(error instanceof Error ? error.message : "Não foi possível abrir esta comanda."))
      .finally(() => setOrderLoading(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setDatabaseMode("local");
      return;
    }

    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const savedProducts = await response.json() as Product[];
          if (!cancelled) {
            setProducts(savedProducts.map((product) => ({
              ...product,
              category: product.category === "frigobar" ? "frigobar" : "adega",
              price: product.price && product.price !== "..." ? product.price : "Consulte",
              description: product.description || "Produto selecionado pela Matto Chalés.",
            })));
            setDatabaseMode("connected");
          }
          return;
        }
        if (!cancelled) setDatabaseMode("local");
      })
      .catch(() => {
        if (!cancelled) setDatabaseMode("local");
      });

    return () => { cancelled = true; };
  }, []);

  const shownProducts = useMemo(() => {
    return products.filter((product) => categoryFilter === "todos" || product.category === categoryFilter);
  }, [products, categoryFilter]);
  const searchGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = products.filter((product) => !normalized || [product.name, product.label, product.description].some((value) => value.toLocaleLowerCase().includes(normalized)));
    return ([
      { id: "adega", label: "Adega", items: matches.filter((product) => product.category === "adega") },
      { id: "frigobar", label: "Frigobar", items: matches.filter((product) => product.category === "frigobar") },
    ] as const).filter((group) => group.items.length > 0);
  }, [products, query]);
  const productCardWidth = isMobile ? 245 : Math.max(260, Math.floor((viewportWidth - 68 - 32) / 3));
  const productCardGap = isMobile ? 12 : 16;

  useEffect(() => {
    productScrollPosition.current = 0;
    productsScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [categoryFilter]);

  function scrollProducts(direction: -1 | 1) {
    const maxScroll = Math.max(0, productScrollWidth.current - productViewportWidth.current);
    const nextOffset = Math.max(0, Math.min(maxScroll, productScrollPosition.current + direction * (productCardWidth + productCardGap)));
    productScrollPosition.current = nextOffset;
    productsScrollRef.current?.scrollTo({ x: nextOffset, animated: true });
  }

  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartRows = Object.entries(cart).map(([name, quantity]) => {
    const product = products.find((item) => item.name === name);
    const unitPrice = effectivePrice(product);
    return { name, quantity, product, unitPrice, lineTotal: unitPrice === null ? null : unitPrice * quantity };
  });
  const cartSubtotal = cartRows.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const hasUnpricedItems = cartRows.some((item) => item.lineTotal === null);

  function addToCart(name: string, quantity = 1) {
    const product = products.find((item) => item.name === name);
    const stock = product?.stockQuantity;
    setCart((current) => {
      const currentQuantity = current[name] ?? 0;
      if (stock !== undefined && currentQuantity >= stock) return current;
      const nextQuantity = stock === undefined ? currentQuantity + quantity : Math.min(stock, currentQuantity + quantity);
      return { ...current, [name]: nextQuantity };
    });
  }

  function openProductDetails(product: Product) {
    setSelectedProduct(product);
    setDetailQuantity(1);
  }

  function removeFromCart(name: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function changeCartQuantity(name: string, amount: number) {
    setCart((current) => {
      const nextQuantity = (current[name] ?? 0) + amount;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[name];
        return next;
      }
      const stock = products.find((product) => product.name === name)?.stockQuantity;
      return { ...current, [name]: stock === undefined ? nextQuantity : Math.min(stock, nextQuantity) };
    });
  }

  async function startComanda() {
    if (!checkoutName.trim() || !checkoutChalet.trim()) {
      setCheckoutError("Informe seu nome e o número do chalé para continuar.");
      return;
    }
    if (cartRows.length === 0) {
      setCheckoutError("Adicione produtos ao carrinho antes de continuar.");
      return;
    }
    if (hasUnpricedItems) {
      setCheckoutError("Há produtos sem preço definido. Peça à loja para atualizar o catálogo.");
      return;
    }
    if (databaseMode !== "connected") {
      setCheckoutError("A comanda precisa de conexão com o catálogo. Tente novamente em instantes.");
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: checkoutName.trim(),
          chaletNumber: checkoutChalet.trim(),
          notes: orderNotes,
          items: cartRows.map(({ product, quantity }) => ({ productId: product?.id, quantity })),
        }),
      });
      const result = await response.json() as { token?: string; order?: OrderView; error?: string; product?: string };
      if (!response.ok || !result.token || !result.order) {
        if (result.error === "PRODUCT_PRICE_UNAVAILABLE") throw new Error(`O produto ${result.product ?? "selecionado"} está sem preço definido.`);
        if (result.error === "PRODUCT_STOCK_UNAVAILABLE") throw new Error(`Estoque insuficiente para ${result.product ?? "um dos produtos"}. Atualize a quantidade no carrinho.`);
        if (result.error === "MONGODB_NOT_CONFIGURED") throw new Error("Não foi possível conectar ao banco para criar a comanda.");
        throw new Error("Não foi possível criar a comanda. Revise os dados e tente novamente.");
      }
      setOrderToken(result.token);
      setOrderViewMode("payment");
      setCurrentOrder(result.order);
      setReceiptDataUrl("");
      setReceiptFileName("");
      setReceiptError("");
      setPixCopied(false);
      setCart({});
      setOrderNotes("");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", `${window.location.pathname}?comanda=${encodeURIComponent(result.token)}`);
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Erro ao criar a comanda.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function copyPixKey() {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(PIX_KEY);
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 2200);
      }
    } catch {
      setCheckoutError("Não foi possível copiar automaticamente. Selecione e copie a chave Pix.");
    }
  }

  function chooseReceiptImage() {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setReceiptError("Selecione uma imagem do comprovante.");
        return;
      }
      setReceiptError("");
      const source = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(source);
          setReceiptError("Não foi possível preparar essa imagem. Tente outra foto.");
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(source);
        canvas.toBlob((blob) => {
          if (!blob || blob.size > 1_800_000) {
            setReceiptError("A imagem ficou muito grande. Escolha uma foto mais leve.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") {
              setReceiptError("Não foi possível ler a imagem. Tente novamente.");
              return;
            }
            setReceiptDataUrl(reader.result);
            setReceiptFileName(file.name.slice(0, 120));
          };
          reader.onerror = () => setReceiptError("Não foi possível ler a imagem. Tente novamente.");
          reader.readAsDataURL(blob);
        }, "image/jpeg", .88);
      };
      image.onerror = () => {
        URL.revokeObjectURL(source);
        setReceiptError("Não foi possível abrir essa imagem. Escolha outra foto.");
      };
      image.src = source;
    };
    input.click();
  }

  async function uploadReceipt() {
    if (!orderToken || !receiptDataUrl) return;
    setReceiptBusy(true);
    setReceiptError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "proof", token: orderToken, fileName: receiptFileName, dataUrl: receiptDataUrl }),
      });
      const result = await response.json() as OrderView | { error?: string };
      if (!response.ok || "error" in result) {
        if ("error" in result && result.error === "FIVEMANAGE_UPLOAD_FAILED") throw new Error("Não foi possível enviar a imagem ao FiveManage. Tente novamente em instantes.");
        throw new Error("Não foi possível anexar o comprovante à comanda.");
      }
      setCurrentOrder(result);
      setReceiptDataUrl("");
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Não foi possível enviar o comprovante.");
    } finally {
      setReceiptBusy(false);
    }
  }

  function sendFinalOrderToWhatsApp() {
    if (!currentOrder || !orderToken) return;
    const finalOrderUrl = Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?pedido=${encodeURIComponent(orderToken)}`
      : `https://wine-shop-kohl.vercel.app/?pedido=${encodeURIComponent(orderToken)}`;
    const message = [
      "Olá! Segue meu pedido",
      `Cliente: ${currentOrder.customerName}`,
      `Chalé: ${currentOrder.chaletNumber}`,
      "Comprovante e itens do pedido:",
      finalOrderUrl,
    ].join("\n");
    void Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => undefined);
  }

  function closeComanda() {
    setCurrentOrder(null);
    setOrderToken("");
    setOrderViewMode("payment");
    setCheckoutError("");
    setReceiptError("");
    setCheckoutName("");
    setCheckoutChalet("");
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    setPanel(null);
    setActive("home");
  }

  function openProductForm(product?: Product) {
    setEditingProductId(product?.id ?? null);
    setProductName(product?.name ?? "");
    setProductLabel(product?.label ?? "");
    setProductCategory(product?.category ?? "adega");
    setProductPrice(product?.price === "..." ? "" : product?.price ?? "");
    setProductPromotionalPrice(product?.promotionalPrice ?? "");
    setProductStockQuantity(product?.stockQuantity === undefined ? "" : String(product.stockQuantity));
    setProductDescription(product?.description ?? "");
    setProductTone(product?.tone ?? "ivory");
    setProductImageUrl(product?.imageUrl ?? "");
    setProductFormError("");
    setProductFormOpen(true);
  }

  async function unlockProductManager() {
    const token = adminTokenInput.trim();
    if (!token) {
      setAdminMessage("Informe a chave de administração configurada no servidor.");
      return;
    }
    try {
      const response = await fetch("/api/admin-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setAdminMessage(response.status === 503 ? "Configure ADMIN_API_TOKEN no Vercel." : "Chave inválida.");
        return;
      }
      setAdminToken(token);
      setAdminUnlocked(true);
      setAdminMessage("Edição autorizada.");
    } catch {
      setAdminMessage("Não foi possível validar a chave agora.");
    }
  }

  async function saveProduct() {
    const name = productName.trim();
    const label = productLabel.trim() || name.toUpperCase();
    if (!name || !productPrice.trim()) {
      setProductFormError(!name ? "Informe o nome do produto." : "Informe o preço do produto.");
      return;
    }
    const stockQuantity = productStockQuantity.trim() === "" ? undefined : Number(productStockQuantity);
    if (stockQuantity !== undefined && (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000)) {
      setProductFormError("Informe um estoque inteiro igual ou maior que zero.");
      return;
    }
    const regularPrice = parsePrice(productPrice);
    const promoPrice = productPromotionalPrice.trim() ? parsePrice(productPromotionalPrice) : null;
    if (productPromotionalPrice.trim() && (promoPrice === null || regularPrice === null || promoPrice >= regularPrice)) {
      setProductFormError("O preço promocional precisa ser menor que o preço normal.");
      return;
    }
    const product: Product = {
      id: editingProductId ?? `product-${Date.now()}`,
      name,
      label,
      category: productCategory,
      price: productPrice.trim(),
      ...(productPromotionalPrice.trim() ? { promotionalPrice: productPromotionalPrice.trim() } : {}),
      ...(stockQuantity !== undefined ? { stockQuantity } : {}),
      description: productDescription.trim() || "Produto selecionado pela Matto Chalés.",
      tone: productTone,
      ...(productImageUrl.trim() ? { imageUrl: productImageUrl.trim() } : {}),
    };
    if (databaseMode === "connected") {
      if (!adminUnlocked || !adminToken) {
        setProductFormError("Desbloqueie a edição de produtos antes de salvar.");
        return;
      }
      try {
        const response = await fetch(editingProductId ? `/api/products?id=${encodeURIComponent(editingProductId)}` : "/api/products", {
          method: editingProductId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(product),
        });
        if (!response.ok) throw new Error("save_failed");
        const saved = await response.json() as Product;
        setProducts((current) => editingProductId
          ? current.map((item) => item.id === editingProductId ? saved : item)
          : [...current, saved]);
      } catch {
        setProductFormError("Não foi possível salvar no MongoDB. Tente novamente.");
        return;
      }
    } else {
      setProducts((current) => editingProductId
        ? current.map((item) => item.id === editingProductId ? product : item)
        : [...current, product]);
    }
    setProductFormOpen(false);
    setEditingProductId(null);
  }

  async function deleteProduct(product: Product) {
    if (databaseMode === "connected") {
      if (!adminUnlocked || !adminToken) {
        setAdminMessage("Desbloqueie a edição antes de remover produtos.");
        return;
      }
      try {
        const response = await fetch(`/api/products?id=${encodeURIComponent(product.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!response.ok) throw new Error("delete_failed");
      } catch {
        setAdminMessage("Não foi possível remover o produto do MongoDB.");
        return;
      }
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
  }

  function pressNav(id: string) {
    if (id === "home") {
      setPanel(null);
      setActive("home");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (panel === id) {
      setPanel(null);
      setActive("home");
      return;
    }
    setPanel(id as PanelName);
    setActive(id);
    if (id === "search") scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const pageStyle = [styles.page, isMobile && styles.pageMobile];
  const panelStyle = styles.panel;
  const canManageProducts = databaseMode === "local" || (databaseMode === "connected" && adminUnlocked);
  const productCards = shownProducts.map((product) => (
    <View style={[styles.productCard, { width: productCardWidth }, isMobile && styles.productCardMobile]} key={product.id}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${product.name}`} onPress={() => openProductDetails(product)} style={styles.productCardDetails}>
        <Text numberOfLines={2} style={styles.cardTitle}>{product.label}</Text>
        <View style={[styles.productBottle, isMobile && styles.productBottleMobile]}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.productPhoto} resizeMode="contain" accessibilityLabel={`Foto de ${product.name}`} /> : <WineBottle tone={product.tone} small />}</View>
        <BodyCopy numberOfLines={isMobile ? 4 : 5} style={[styles.productDescription, isMobile && styles.productDescriptionMobile]}>{product.description}</BodyCopy>
        <Text style={styles.stars}>★★★★★</Text>
      </Pressable>
      <View style={styles.cardBottom}><Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${product.name}`} onPress={() => openProductDetails(product)} style={styles.cardPriceBlock}>{product.promotionalPrice ? <Text style={styles.oldPrice}>{product.price}</Text> : null}<Text style={styles.cardPrice}>{product.promotionalPrice || product.price}</Text>{product.promotionalPrice ? <Text style={styles.promotionBadge}>PROMOÇÃO</Text> : null}</Pressable><Pressable disabled={product.stockQuantity === 0} onPress={() => addToCart(product.name)} style={[styles.primaryButton, styles.tinyButton, product.stockQuantity === 0 && styles.adminButtonDisabled]}><Text style={styles.tinyButtonText}>{product.stockQuantity === 0 ? "Esgotado" : "Adicionar ao Carrinho"}</Text></Pressable></View>
    </View>
  ));
  const renderAdminProductRows = (items: Product[]) => items.length
    ? <View style={styles.adminProductList}>{items.map((product) => <View style={styles.adminProductRow} key={product.id}><View style={styles.adminProductInfo}><Text style={styles.adminProductName}>{product.name}</Text><Text style={styles.adminProductMeta}>{product.label} · {product.promotionalPrice ? `${product.promotionalPrice} (promo; normal ${product.price})` : product.price} · {product.stockQuantity === undefined ? "Estoque não controlado" : `${product.stockQuantity} un. em estoque`} · {product.category === "frigobar" ? "Frigobar" : "Adega"}</Text></View><Pressable disabled={!canManageProducts} onPress={() => openProductForm(product)} style={styles.adminActionLink}><Text style={[styles.adminActionText, !canManageProducts && styles.adminDisabled]}>Editar</Text></Pressable><Pressable disabled={!canManageProducts} accessibilityLabel={`Excluir ${product.name}`} onPress={() => deleteProduct(product)} style={styles.adminActionLink}><Text style={[styles.deleteActionText, !canManageProducts && styles.adminDisabled]}>Excluir</Text></Pressable></View>)}</View>
    : <Text style={styles.adminEmpty}>Nenhum produto nesta seção.</Text>;
  const navContent = (
    <View style={styles.navItems}>
      {navItems.map((item) => {
        const isActive = active === item.id;
        const isButton = item.id !== "home";
        const Icon = item.Icon;
        const visibleLabel = isSmallMobile && item.id === "settings" ? "Ajustes" : item.label;
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.82}
            accessibilityRole={isButton ? "button" : "link"}
            accessibilityLabel={item.id === "cart" ? `Carrinho, ${cartCount} itens` : item.label}
            accessibilityState={{ selected: isActive, expanded: panel === item.id }}
            onPress={() => pressNav(item.id)}
            style={[styles.navItem, isActive && styles.navItemActive]}
          >
            <Icon size={19} color={isActive ? "#d7ad7d" : "#c9c0b7"} strokeWidth={1.8} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.navLabel, isActive && styles.navLabelActive]}>{visibleLabel}</Text>
            {item.id === "cart" && <Text style={styles.badge}>{cartCount}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.appRoot}>
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled">
          <View style={pageStyle}>
            <View style={[styles.header, isMobile && styles.headerMobile]}>
              <View style={styles.brandLockup}>
                <Image source={require("./assets/matto-chales-cabana.png")} style={[styles.brandLogo, isMobile && styles.brandLogoMobile]} resizeMode="contain" accessibilityLabel="Logo da cabana Matto Chalés" />
                <Text style={[styles.brand, isMobile && styles.brandMobile]}>Matto <Text style={styles.brandAccent}>Chalés</Text></Text>
              </View>
            </View>

              <View style={[styles.hero, isMobile && styles.heroMobile]}>
              <View style={[styles.heroCopy, isMobile && styles.heroCopyMobile]}>
                <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile, isSmallMobile && styles.heroTitleSmall]}>SEJA BEM-VINDO{"\n"}À NOSSA ADEGA</Text>
                <Text style={styles.heroTagline}>AS MELHORES BEBIDAS ESTÃO AQUI</Text>
              </View>
              <View style={[styles.heroStaticPhotoArea, isMobile && styles.heroStaticPhotoAreaMobile]}>
                <Image source={{ uri: HERO_IMAGE_URL }} style={styles.heroStaticPhoto} resizeMode="contain" accessibilityLabel="Cesta de vinhos Matto Chalés" />
              </View>
            </View>

            <View style={[styles.productsSection, isMobile && styles.productsSectionMobile]}>
              <View style={[styles.sectionHeadingLine, isMobile && styles.sectionHeadingLineMobile]}><SectionTitle compact={isMobile}>NOSSOS PRODUTOS</SectionTitle></View>
              <View style={[styles.catalogControls, isMobile && styles.catalogControlsMobile]}>
                <View style={[styles.catalogFilters, isMobile && styles.catalogFiltersMobile]} accessibilityRole="radiogroup" accessibilityLabel="Filtrar produtos por categoria">
                  {productCategoryFilters.map((filter) => <Pressable key={filter.id} accessibilityRole="radio" accessibilityState={{ checked: categoryFilter === filter.id }} onPress={() => setCategoryFilter(filter.id)} style={[styles.catalogFilterButton, categoryFilter === filter.id && styles.catalogFilterButtonActive]}><Text style={[styles.catalogFilterLabel, categoryFilter === filter.id && styles.catalogFilterLabelActive]}>{filter.label}</Text></Pressable>)}
                </View>
                <View style={[styles.arrows, styles.catalogArrows, isMobile && styles.arrowsMobile]}><Pressable accessibilityRole="button" accessibilityLabel="Produto anterior" onPress={() => scrollProducts(-1)} style={[styles.arrow, isMobile && styles.arrowMobile]}><ChevronLeft size={15} color="#f2ece5" strokeWidth={2} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Próximo produto" onPress={() => scrollProducts(1)} style={[styles.arrow, styles.arrowActive, isMobile && styles.arrowMobile]}><ChevronRight size={15} color="#f2ece5" strokeWidth={2} /></Pressable></View>
              </View>
              <ScrollView ref={productsScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.productGrid, isMobile && styles.productGridMobile]} onLayout={(event) => { productViewportWidth.current = event.nativeEvent.layout.width; }} onContentSizeChange={(width) => { productScrollWidth.current = width; }} onScroll={(event) => { productScrollPosition.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}>
                {productCards}
              </ScrollView>
              {products.length === 0 && query.length === 0 && <Text style={styles.emptyCatalog}>Nenhum produto cadastrado. Cadastre novos produtos em Configurações.</Text>}
              {query.length === 0 && categoryFilter !== "todos" && shownProducts.length === 0 && products.length > 0 && <Text style={styles.noResults}>Nenhum produto nesta categoria.</Text>}
            </View>

            <View style={[styles.footer, isMobile && styles.footerMobile]}>
              <View style={[styles.footerColumn, isMobile && styles.footerAboutMobile]}><Text style={styles.footerBrand}>Matto Chalés</Text><BodyCopy>...</BodyCopy><Text style={styles.social}>◉  ◎  ◌  ◉</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>LINKS RÁPIDOS</Text><Text style={styles.footerLink}>Início</Text><Text style={styles.footerLink}>Produtos</Text><Text style={styles.footerLink}>Contato</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>CONTATO</Text><Text style={styles.footerLink}>⌖  ...</Text><Text style={styles.footerLink}>☎  ...</Text><Text style={styles.footerLink}>✉  ...</Text></View>
            </View>
            <Text style={styles.copyright}>...</Text>
          </View>
        </ScrollView>

        {panel === "search" && <View style={[styles.searchScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.searchScreenContent, !isMobile && styles.searchScreenContentWide]}>
            <View style={styles.searchScreenHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={() => { setPanel(null); setActive("home"); }} style={styles.searchBackButton}><ChevronLeft size={24} color="#d5a472" strokeWidth={2} /><Text style={styles.searchBackText}>Voltar</Text></Pressable>
              <Text style={styles.searchScreenTitle}>Buscar produtos</Text>
            </View>
            <View style={styles.searchPageBar}>
              <Search size={19} color="#c18d5e" strokeWidth={2} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar vinhos e bebidas..." placeholderTextColor="#9e9388" style={styles.searchPageInput} autoFocus accessibilityLabel="Buscar produtos" returnKeyType="search" />
              {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setQuery("")} style={styles.searchClearButton}><X size={17} color="#c9c0b7" /></Pressable>}
            </View>
            <ScrollView style={styles.searchResultsScroll} contentContainerStyle={styles.searchResultsContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.searchResultsCaption}>{query.trim() ? `Resultados para “${query.trim()}”` : "Produtos por categoria"}</Text>
              {searchGroups.map((group) => <View key={group.id} style={styles.searchCategoryGroup}>
                <View style={styles.searchCategoryHeading}><Text style={styles.searchCategoryTitle}>{group.label}</Text><Text style={styles.searchCategoryCount}>{group.items.length} {group.items.length === 1 ? "produto" : "produtos"}</Text></View>
                {group.items.map((product) => <View key={product.id} style={styles.searchProductRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${product.name}`} onPress={() => openProductDetails(product)} style={styles.searchProductDetails}><View style={styles.searchProductImageWrap}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.searchProductImage} resizeMode="contain" accessibilityLabel={`Foto de ${product.name}`} /> : <View style={styles.searchBottleFallback}><WineBottle tone={product.tone} small /></View>}</View>
                  <View style={styles.searchProductInfo}><Text numberOfLines={2} style={styles.searchProductName}>{product.name}</Text><BodyCopy numberOfLines={2} style={styles.searchProductDescription}>{product.description}</BodyCopy>{product.promotionalPrice ? <Text style={styles.oldPrice}>{product.price}</Text> : null}<Text style={styles.searchProductPrice}>{product.promotionalPrice || product.price}</Text>{product.stockQuantity !== undefined && <Text style={styles.stockHint}>{product.stockQuantity === 0 ? "Esgotado" : `${product.stockQuantity} disponível(is)`}</Text>}</View></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar ${product.name} ao carrinho`} disabled={product.stockQuantity === 0} onPress={() => addToCart(product.name)} style={[styles.searchAddButton, product.stockQuantity === 0 && styles.adminButtonDisabled]}><Plus size={15} color="#fff" strokeWidth={2.4} /><Text style={styles.searchAddButtonText}>{product.stockQuantity === 0 ? "Esgotado" : "Adicionar"}</Text></Pressable>
                </View>)}
              </View>)}
              {products.length === 0 && <Text style={styles.searchEmpty}>Nenhum produto cadastrado. Cadastre novos produtos em Configurações.</Text>}
              {products.length > 0 && searchGroups.length === 0 && <Text style={styles.searchEmpty}>Nenhum produto encontrado. Tente outro termo.</Text>}
            </ScrollView>
          </View>
        </View>}

        {selectedProduct && <View style={[styles.productDetailScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.productDetailContent, !isMobile && styles.productDetailContentWide]}>
            <View style={styles.productDetailHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => setSelectedProduct(null)} style={styles.productDetailBack}><ChevronLeft size={23} color="#d5a472" strokeWidth={2} /><Text style={styles.productDetailBackText}>Voltar</Text></Pressable>
              <Text style={styles.productDetailHeaderTitle}>Detalhes do produto</Text>
            </View>
            <ScrollView style={styles.productDetailScroll} contentContainerStyle={[styles.productDetailBody, isMobile && styles.productDetailBodyMobile]}>
              {isMobile && <View style={styles.productDetailCategory}><Text style={styles.productDetailCategoryText}>{selectedProduct.category === "frigobar" ? "FRIGOBAR" : "ADEGA"}</Text></View>}
              <View style={[styles.productDetailHero, isMobile && styles.productDetailHeroMobile]}>
                {selectedProduct.imageUrl ? <Image source={{ uri: selectedProduct.imageUrl }} style={styles.productDetailImage} resizeMode="contain" accessibilityLabel={`Foto de ${selectedProduct.name}`} /> : <View style={styles.productDetailBottle}><WineBottle tone={selectedProduct.tone} /></View>}
              </View>
              <View style={styles.productDetailInfo}>
                {!isMobile && <View style={styles.productDetailCategory}><Text style={styles.productDetailCategoryText}>{selectedProduct.category === "frigobar" ? "FRIGOBAR" : "ADEGA"}</Text></View>}
                <Text style={styles.productDetailName}>{selectedProduct.label || selectedProduct.name}</Text>
                {selectedProduct.label && selectedProduct.label !== selectedProduct.name && <Text style={styles.productDetailSubtitle}>{selectedProduct.name}</Text>}
                {selectedProduct.promotionalPrice && <Text style={styles.detailOldPrice}>{selectedProduct.price}</Text>}
                <Text style={[styles.productDetailPrice, selectedProduct.promotionalPrice && { marginTop: 0 }]}>{parsePrice(selectedProduct.promotionalPrice || selectedProduct.price) === null ? (selectedProduct.promotionalPrice || selectedProduct.price) : formatPrice(parsePrice(selectedProduct.promotionalPrice || selectedProduct.price)!)}</Text>
                {selectedProduct.stockQuantity !== undefined && <Text style={styles.stockHint}>{selectedProduct.stockQuantity === 0 ? "Produto esgotado" : `${selectedProduct.stockQuantity} unidade(s) disponível(is)`}</Text>}
                <View style={styles.productDetailDivider} />
                <Text style={styles.productDetailSectionTitle}>Sobre este produto</Text>
                <Text style={styles.productDetailDescription}>{selectedProduct.description}</Text>
                <View style={styles.productDetailQuantityRow}><View><Text style={styles.productDetailSectionTitle}>Quantidade</Text><Text style={styles.productDetailQuantityHint}>Escolha quantas unidades deseja</Text></View><View style={styles.productDetailQuantityControl}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Diminuir quantidade" disabled={detailQuantity <= 1} onPress={() => setDetailQuantity((quantity) => Math.max(1, quantity - 1))} style={[styles.productDetailQuantityButton, detailQuantity <= 1 && styles.productDetailQuantityButtonDisabled]}><Minus size={16} color="#eee5da" /></Pressable>
                  <Text style={styles.productDetailQuantity}>{detailQuantity}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Aumentar quantidade" disabled={selectedProduct.stockQuantity !== undefined && detailQuantity >= selectedProduct.stockQuantity} onPress={() => setDetailQuantity((quantity) => Math.min(selectedProduct.stockQuantity ?? quantity + 1, quantity + 1))} style={[styles.productDetailQuantityButton, selectedProduct.stockQuantity !== undefined && detailQuantity >= selectedProduct.stockQuantity && styles.productDetailQuantityButtonDisabled]}><Plus size={16} color="#eee5da" /></Pressable>
                </View></View>
              </View>
            </ScrollView>
            <View style={styles.productDetailFooter}><View style={styles.productDetailTotal}><Text style={styles.productDetailTotalLabel}>Total</Text><Text style={styles.productDetailTotalValue}>{parsePrice(selectedProduct.promotionalPrice || selectedProduct.price) === null ? (selectedProduct.promotionalPrice || selectedProduct.price) : formatPrice(parsePrice(selectedProduct.promotionalPrice || selectedProduct.price)! * detailQuantity)}</Text></View><Pressable accessibilityRole="button" disabled={selectedProduct.stockQuantity === 0} onPress={() => { addToCart(selectedProduct.name, detailQuantity); setSelectedProduct(null); }} style={[styles.productDetailAddButton, selectedProduct.stockQuantity === 0 && styles.adminButtonDisabled]}><ShoppingBag size={17} color="#fff" strokeWidth={2} /><Text style={styles.productDetailAddText}>{selectedProduct.stockQuantity === 0 ? "Esgotado" : "Adicionar ao Carrinho"}</Text></Pressable></View>
          </View>
        </View>}

        {panel === "cart" && <View style={[styles.cartScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.cartContent, !isMobile && styles.cartContentWide]}>
            <View style={styles.cartScreenHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={() => { setPanel(null); setActive("home"); }} style={styles.cartBackButton}><ChevronLeft size={24} color="#d5a472" strokeWidth={2} /><Text style={styles.cartBackText}>Voltar</Text></Pressable>
              <View pointerEvents="none" style={styles.cartTitleRow}><Text style={styles.cartScreenTitle}>Carrinho</Text><ShoppingBag size={18} color="#d5a472" />{cartCount > 0 && <Text style={styles.cartCountPill}>{cartCount}</Text>}</View>
            </View>

            {cartRows.length === 0 ? <View style={styles.cartEmpty}>
              <View style={styles.cartEmptyIcon}><ShoppingBag size={31} color="#c18d5e" /></View>
              <Text style={styles.cartEmptyTitle}>Seu carrinho está vazio</Text>
              <Text style={styles.cartEmptyCopy}>Explore nossos produtos e adicione seus favoritos para continuar.</Text>
              <Pressable onPress={() => { setPanel(null); setActive("home"); scrollRef.current?.scrollTo({ y: 0, animated: true }); }} style={styles.cartPrimaryButton}><Text style={styles.cartPrimaryButtonText}>Ver produtos</Text></Pressable>
            </View> : <>
              <ScrollView style={styles.cartItemsScroll} contentContainerStyle={styles.cartItemsContent} keyboardShouldPersistTaps="handled">
                <View style={styles.cartSectionHeader}><Text style={styles.cartSectionTitle}>Itens do pedido</Text><Text style={styles.cartSectionMeta}>{cartCount} {cartCount === 1 ? "item" : "itens"}</Text></View>
                {cartRows.map(({ name, quantity, product, unitPrice, lineTotal }) => <View style={styles.cartProductRow} key={name}>
                  <View style={styles.cartProductImageWrap}>{product?.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.cartProductImage} resizeMode="cover" accessibilityLabel={`Foto de ${name}`} /> : <View style={styles.cartBottleFallback}><WineBottle tone={product?.tone} small /></View>}</View>
                  <View style={styles.cartProductInfo}>
                    <Text style={styles.cartProductName}>{name}</Text>
                    {!!product?.label && <Text style={styles.cartProductLabel}>{product.label}</Text>}
                    {product?.promotionalPrice && <Text style={styles.oldPrice}>{product.price}</Text>}
                    <Text style={styles.cartProductPrice}>{unitPrice === null ? "Preço a confirmar" : formatPrice(unitPrice)}</Text>
                    {product?.stockQuantity !== undefined && <Text style={styles.stockHint}>{product.stockQuantity === 0 ? "Esgotado" : `${product.stockQuantity} unidade(s) em estoque`}</Text>}
                    {lineTotal !== null && quantity > 1 && <Text style={styles.cartLineTotal}>Total: {formatPrice(lineTotal)}</Text>}
                    <View style={styles.cartQuantityControl}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Diminuir quantidade de ${name}`} onPress={() => changeCartQuantity(name, -1)} style={styles.cartQuantityButton}><Minus size={15} color="#eee5da" /></Pressable>
                      <Text style={styles.cartQuantity}>{quantity}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Aumentar quantidade de ${name}`} disabled={product?.stockQuantity !== undefined && quantity >= product.stockQuantity} onPress={() => changeCartQuantity(name, 1)} style={[styles.cartQuantityButton, product?.stockQuantity !== undefined && quantity >= product.stockQuantity && styles.productDetailQuantityButtonDisabled]}><Plus size={15} color="#eee5da" /></Pressable>
                    </View>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${name} da sacola`} onPress={() => removeFromCart(name)} style={styles.cartDeleteButton}><Trash2 size={17} color="#b8a18c" /></Pressable>
                </View>)}
                <View style={styles.cartCheckoutFields}>
                  <Text style={styles.cartNotesLabel}>Dados para a comanda</Text>
                  <TextInput value={checkoutName} onChangeText={setCheckoutName} placeholder="Seu nome" placeholderTextColor="#94877b" style={styles.checkoutTextInput} accessibilityLabel="Seu nome" />
                  <TextInput value={checkoutChalet} onChangeText={setCheckoutChalet} placeholder="Número do chalé" placeholderTextColor="#94877b" style={styles.checkoutTextInput} accessibilityLabel="Número do chalé" />
                </View>
                <View style={styles.cartNotesBlock}><Text style={styles.cartNotesLabel}>Observações para a loja <Text style={styles.cartOptional}>(opcional)</Text></Text><TextInput value={orderNotes} onChangeText={setOrderNotes} placeholder="Alguma preferência para este pedido?" placeholderTextColor="#94877b" multiline style={styles.cartNotesInput} accessibilityLabel="Observações para a loja" /></View>
              </ScrollView>

              <View style={styles.cartSummary}>
                <View style={styles.cartSummaryLine}><Text style={styles.cartSummaryLabel}>Subtotal</Text><Text style={styles.cartSummaryValue}>{formatPrice(cartSubtotal)}{hasUnpricedItems ? "*" : ""}</Text></View>
                <View style={styles.cartTotalLine}><Text style={styles.cartTotalLabel}>{hasUnpricedItems ? "Subtotal parcial" : "Total dos produtos"}</Text><Text style={styles.cartTotalValue}>{formatPrice(cartSubtotal)}{hasUnpricedItems ? "*" : ""}</Text></View>
                {hasUnpricedItems && <Text style={styles.cartPriceDisclaimer}>* O preço de um ou mais itens será confirmado pela loja.</Text>}
                {!!checkoutError && !currentOrder && <Text style={styles.checkoutError}>{checkoutError}</Text>}
                <Pressable disabled={checkoutBusy} onPress={() => void startComanda()} style={[styles.cartPrimaryButton, checkoutBusy && styles.checkoutButtonDisabled]}><Text style={styles.cartPrimaryButtonText}>{checkoutBusy ? "Criando comanda…" : "Continuar para o Pix"}</Text></Pressable>
                <Text style={styles.cartCheckoutHint}>Você pagará pela chave Pix e enviará o comprovante para conferência.</Text>
              </View>
            </>}
          </View>
        </View>}

        {(orderLoading || currentOrder || (orderToken && checkoutError)) && orderViewMode === "payment" && <View style={[styles.comandaScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.comandaContent, !isMobile && styles.comandaContentWide]}>
            <View style={styles.comandaHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={closeComanda} style={styles.comandaBack}><ChevronLeft size={23} color="#d5a472" strokeWidth={2} /><Text style={styles.comandaBackText}>Loja</Text></Pressable>
              <View style={styles.comandaHeaderTitle}><Text style={styles.comandaTitle}>Sua comanda</Text><Text style={styles.comandaSubtitle}>Pagamento via Pix</Text></View>
            </View>
            {orderLoading && <Text style={styles.comandaLoading}>Carregando comanda…</Text>}
            {!orderLoading && !currentOrder && <View style={styles.comandaErrorState}><Text style={styles.comandaErrorText}>{checkoutError || "Não foi possível abrir esta comanda."}</Text><Pressable onPress={closeComanda} style={styles.comandaPrimaryButton}><Text style={styles.comandaPrimaryButtonText}>Voltar para a loja</Text></Pressable></View>}
            {currentOrder && <>
              <ScrollView style={styles.comandaScroll} contentContainerStyle={styles.comandaBody} keyboardShouldPersistTaps="handled">
                <View style={styles.comandaOrderHeading}><View><Text style={styles.comandaOrderNumber}>{currentOrder.id}</Text><Text style={styles.comandaOrderMeta}>{currentOrder.customerName} · Chalé {currentOrder.chaletNumber}</Text></View><View style={styles.comandaStatus}><Text style={styles.comandaStatusText}>{currentOrder.status === "proof_submitted" ? "AGUARDANDO CONFERÊNCIA" : "AGUARDANDO PAGAMENTO"}</Text></View></View>
                <View style={styles.comandaSection}><Text style={styles.comandaSectionTitle}>Resumo do pedido</Text>
                  {currentOrder.items.map((item, index) => <View key={`${item.productId}-${index}`} style={styles.comandaItem}><View style={styles.comandaItemInfo}><Text style={styles.comandaItemName}>{item.quantity}× {item.label || item.name}</Text><Text style={styles.comandaItemUnit}>{formatPrice(item.unitPrice)} cada</Text></View><Text style={styles.comandaItemTotal}>{formatPrice(item.unitPrice * item.quantity)}</Text></View>)}
                  {!!currentOrder.notes && <Text style={styles.comandaNotes}>Observações: {currentOrder.notes}</Text>}
                  <View style={styles.comandaTotalRow}><Text style={styles.comandaTotalLabel}>Total do pedido</Text><Text style={styles.comandaTotalValue}>{formatPrice(currentOrder.subtotal)}</Text></View>
                </View>
                <View style={styles.pixCard}><Text style={styles.comandaSectionTitle}>Pague com Pix</Text><Text style={styles.pixInstructions}>Copie a chave abaixo e faça o pagamento no aplicativo do seu banco. Confira o valor de {formatPrice(currentOrder.subtotal)}.</Text><View style={styles.pixKeyRow}><Text selectable style={styles.pixKeyText}>{PIX_KEY}</Text><Pressable accessibilityRole="button" accessibilityLabel="Copiar chave Pix" onPress={() => void copyPixKey()} style={styles.pixCopyButton}>{pixCopied ? <Check size={17} color="#d5a472" /> : <Copy size={17} color="#d5a472" />}<Text style={styles.pixCopyText}>{pixCopied ? "Copiada" : "Copiar"}</Text></Pressable></View><Text style={styles.pixAccountHint}>Chave Pix por e-mail · Matto Chalés</Text></View>
                <View style={styles.receiptCard}><Text style={styles.comandaSectionTitle}>Comprovante de pagamento</Text><Text style={styles.receiptInstructions}>Anexe uma imagem nítida do comprovante para enviar junto com esta comanda pelo WhatsApp.</Text>
                  <Pressable accessibilityRole="button" onPress={chooseReceiptImage} style={styles.receiptChooseButton}><Text style={styles.receiptChooseButtonText}>{receiptDataUrl ? "Escolher outra imagem" : currentOrder.proof ? "Trocar comprovante" : "Anexar comprovante"}</Text></Pressable>
                  {!!receiptDataUrl && <View style={styles.receiptPreview}><Image source={{ uri: receiptDataUrl }} style={styles.receiptPreviewImage} resizeMode="contain" accessibilityLabel="Prévia do comprovante selecionado" /><Text numberOfLines={1} style={styles.receiptFileName}>{receiptFileName}</Text><Pressable disabled={receiptBusy} onPress={() => void uploadReceipt()} style={[styles.receiptSubmitButton, receiptBusy && styles.checkoutButtonDisabled]}><Text style={styles.receiptSubmitText}>{receiptBusy ? "Anexando…" : "Anexar à comanda"}</Text></Pressable></View>}
                  {!receiptDataUrl && currentOrder.proof && <View style={styles.receiptSaved}><Check size={16} color="#d5a472" /><Text style={styles.receiptSavedText}>{currentOrder.proof.storage === "fivemanage" ? "Foto salva no FiveManage" : "Foto salva no banco de dados"}</Text></View>}
                  {!!receiptError && <Text style={styles.checkoutError}>{receiptError}</Text>}
                  <Text style={styles.receiptDisclaimer}>O comprovante não confirma o crédito. A loja verificará o pagamento no banco antes de confirmar o pedido.</Text>
                </View>
              </ScrollView>
              <View style={styles.comandaFooter}>
                {currentOrder.proof ? <Pressable accessibilityRole="button" onPress={sendFinalOrderToWhatsApp} style={styles.comandaPrimaryButton}><Text style={styles.comandaPrimaryButtonText}>Enviar comanda pelo WhatsApp</Text></Pressable> : <Text style={styles.comandaFooterHint}>Anexe o comprovante para liberar o envio da comanda.</Text>}
              </View>
            </>}
          </View>
        </View>}

        {(orderLoading || currentOrder || (orderToken && checkoutError)) && orderViewMode === "final" && <View style={[styles.finalOrderScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.finalOrderContent, !isMobile && styles.comandaContentWide]}>
            <View style={styles.finalOrderHeader}><Text style={styles.finalOrderTitle}>Resumo do pedido</Text></View>
            {orderLoading && <Text style={styles.comandaLoading}>Carregando pedido…</Text>}
            {!orderLoading && !currentOrder && <View style={styles.comandaErrorState}><Text style={styles.comandaErrorText}>{checkoutError || "Não foi possível abrir este pedido."}</Text></View>}
            {currentOrder && <ScrollView style={styles.finalOrderScroll} contentContainerStyle={styles.finalOrderBody}>
              <View style={styles.finalOrderItems}>
                {currentOrder.items.map((item, index) => <View key={`${item.productId}-${index}`} style={styles.finalOrderItem}><Text style={styles.finalOrderItemName}>{item.quantity} × {item.label || item.name}</Text></View>)}
              </View>
              <View style={styles.finalOrderTotal}><Text style={styles.finalOrderTotalLabel}>Total</Text><Text style={styles.finalOrderTotalValue}>{formatPrice(currentOrder.subtotal)}</Text></View>
              <View style={styles.finalOrderProof}><Text style={styles.finalOrderProofTitle}>Comprovante</Text>{currentOrder.proof?.url || currentOrder.proof?.dataUrl ? <Image source={{ uri: currentOrder.proof.url || currentOrder.proof.dataUrl }} style={styles.finalOrderProofImage} resizeMode="contain" accessibilityLabel="Prévia do comprovante anexado" /> : <Text style={styles.finalOrderProofMissing}>Nenhum comprovante anexado.</Text>}</View>
            </ScrollView>}
          </View>
        </View>}

        {panel === "settings" && (
        <View style={panel === "settings" ? [styles.settingsScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }] : [styles.panelPosition, { bottom: Math.max(100, insets.bottom + 91) }]}>
            <View style={panel === "settings" ? styles.settingsScreenPanel : panelStyle}>
              {panel === "settings" ? (
                <View style={styles.settingsScreenHeader}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={() => { setPanel(null); setActive("home"); }} style={styles.settingsBackButton}><Text style={styles.settingsBackArrow}>‹</Text><Text style={styles.settingsBackText}>Loja</Text></Pressable>
                  <View style={styles.settingsScreenHeadingCopy}><Text style={styles.settingsScreenTitle}>Configurações</Text><Text style={styles.settingsScreenSubtitle}>Gerencie seus produtos e o catálogo</Text></View>
                </View>
              ) : (
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>Seu carrinho</Text>
                  <Pressable accessibilityLabel="Fechar painel" onPress={() => setPanel(null)}><Text style={styles.panelClose}>×</Text></Pressable>
                </View>
              )}
              {panel === "settings" && (productFormOpen ? (
                <ScrollView style={[styles.adminScroll, styles.adminScrollFull]} contentContainerStyle={styles.adminForm} keyboardShouldPersistTaps="handled">
                  <Text style={styles.adminHint}>{editingProductId ? "Edite as informações do produto." : "Cadastre um produto para sua vitrine."}</Text>
                  <Text style={styles.settingLabel}>Nome do produto</Text>
                  <TextInput value={productName} onChangeText={setProductName} placeholder="Ex.: Vinho tinto" placeholderTextColor="#9e9388" style={styles.searchInput} />
                  <Text style={styles.settingLabel}>Título do cartão</Text>
                  <TextInput value={productLabel} onChangeText={setProductLabel} placeholder="Ex.: VINHO TINTO" placeholderTextColor="#9e9388" style={styles.searchInput} />
                  <Text style={styles.settingLabel}>Categoria do produto</Text>
                  <View style={styles.productCategoryOptions}>{([["adega", "Adega"], ["frigobar", "Frigobar"]] as const).map(([category, label]) => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ checked: productCategory === category }} onPress={() => setProductCategory(category)} style={[styles.productCategoryOption, productCategory === category && styles.productCategoryOptionActive]}><Text style={styles.productCategoryOptionText}>{label}</Text></Pressable>)}</View>
                  <Text style={styles.settingLabel}>Preço normal</Text>
                  <TextInput value={productPrice} onChangeText={setProductPrice} placeholder="Ex.: R$ 89,90" placeholderTextColor="#9e9388" style={styles.searchInput} />
                  <Text style={styles.settingLabel}>Preço promocional (opcional)</Text>
                  <TextInput value={productPromotionalPrice} onChangeText={setProductPromotionalPrice} placeholder="Ex.: R$ 79,90" placeholderTextColor="#9e9388" style={styles.searchInput} />
                  <Text style={styles.settingLabel}>Quantidade em estoque (opcional)</Text>
                  <TextInput value={productStockQuantity} onChangeText={setProductStockQuantity} placeholder="Em branco = sem controle de estoque" placeholderTextColor="#9e9388" keyboardType="number-pad" style={styles.searchInput} />
                  <Text style={styles.adminHint}>Use 0 para marcar como esgotado. O estoque é descontado quando o cliente envia o comprovante.</Text>
                  <Text style={styles.settingLabel}>Descrição</Text>
                  <TextInput value={productDescription} onChangeText={setProductDescription} placeholder="Descreva o produto para a vitrine" placeholderTextColor="#9e9388" multiline style={[styles.searchInput, styles.descriptionInput]} />
                  <Text style={styles.settingLabel}>Foto do produto (URL)</Text>
                  <TextInput value={productImageUrl} onChangeText={setProductImageUrl} placeholder="https://..." placeholderTextColor="#9e9388" autoCapitalize="none" keyboardType="url" style={styles.searchInput} />
                  {!!productFormError && <Text style={styles.formError}>{productFormError}</Text>}
                  <View style={styles.adminActions}><Pressable onPress={() => setProductFormOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancelar</Text></Pressable><Pressable onPress={saveProduct} style={styles.primaryButton}><Text style={styles.buttonText}>{editingProductId ? "Salvar" : "Criar produto"}</Text></Pressable></View>
                </ScrollView>
              ) : (
                <ScrollView style={[styles.adminScroll, styles.adminScrollFull]} contentContainerStyle={styles.adminForm}>
                  <Text style={styles.adminHint}>{databaseMode === "checking" ? "Verificando conexão…" : databaseMode === "connected" ? "Catálogo conectado ao MongoDB." : "Modo local: as alterações ficam apenas nesta sessão até configurar o MongoDB."}</Text>
                  {databaseMode === "connected" && !adminUnlocked && <View style={styles.adminAccess}><TextInput value={adminTokenInput} onChangeText={setAdminTokenInput} placeholder="Chave de administração" placeholderTextColor="#9e9388" secureTextEntry style={styles.searchInput} /><Pressable onPress={unlockProductManager} style={styles.primaryButton}><Text style={styles.buttonText}>Desbloquear edição</Text></Pressable>{!!adminMessage && <Text style={styles.adminFeedback}>{adminMessage}</Text>}</View>}
                  {!!adminMessage && (databaseMode !== "connected" || adminUnlocked) && <Text style={styles.adminFeedback}>{adminMessage}</Text>}
                  <View style={styles.adminSection}><Text style={styles.adminSectionTitle}>Catálogo de produtos</Text><Text style={styles.adminSectionHint}>Gerencie os produtos disponíveis na loja.</Text>{renderAdminProductRows(products)}</View>
                  <Pressable disabled={!canManageProducts} onPress={() => openProductForm()} style={[styles.primaryButton, styles.createProductButton, !canManageProducts && styles.adminButtonDisabled]}><Text style={styles.buttonText}>+ Novo produto</Text></Pressable>
                </ScrollView>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.navPosition, { bottom: Math.max(13, insets.bottom + 8) }]}>
          {Platform.OS === "ios" ? (
              <GlassView style={styles.navSurface} glassEffectStyle="regular" tintColor="rgba(62, 39, 25, 0.42)" isInteractive>
              {navContent}
            </GlassView>
          ) : (
            <View style={[styles.navSurface, webGlassStyle]}>{navContent}</View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0d0b09" },
  appRoot: { flex: 1, backgroundColor: "#0d0b09" },
  scrollContent: { paddingBottom: 140, backgroundColor: "#2c1b12" },
  page: { width: "100%", alignSelf: "stretch", backgroundColor: "#0d0b09", overflow: "hidden" },
  pageMobile: { width: "100%" },
  header: { height: 72, paddingHorizontal: 28, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#49372a", flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0d0b09" },
  headerMobile: { height: 60, paddingHorizontal: 18 },
  expandedSearch: { minHeight: 64, paddingHorizontal: 28, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#15100c", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  expandedSearchMobile: { minHeight: 58, paddingHorizontal: 18, gap: 10 },
  expandedSearchInput: { flex: 1, minWidth: 0, height: 42, paddingHorizontal: 2, color: "#fff", fontSize: 16, backgroundColor: "transparent", outlineStyle: "none" } as any,
  expandedSearchClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#211912" },
  brand: { color: "#f3f1ef", fontSize: 27, fontWeight: "700", letterSpacing: -1 },
  brandMobile: { fontSize: 24 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLogo: { width: 56, height: 42 },
  brandLogoMobile: { width: 44, height: 34 },
  brandAccent: { color: "#c18d5e" },
  hero: { minHeight: 650, paddingHorizontal: 34, paddingVertical: 48, backgroundColor: "#18110d", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", gap: 18, position: "relative", overflow: "hidden" },
  heroMobile: { minHeight: 0, paddingHorizontal: 18, paddingTop: 36, paddingBottom: 28, flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 0 },
  heroCopy: { flex: 0, zIndex: 2 },
  heroCopyMobile: { flex: 0, flexBasis: "auto", flexShrink: 0 },
  heroTitle: { color: "#f5f2f0", fontSize: 57, lineHeight: 62, fontWeight: "800", letterSpacing: -2 },
  heroTitleMobile: { fontSize: 43, lineHeight: 47, letterSpacing: -1.5 },
  heroTitleSmall: { fontSize: 37, lineHeight: 41 },
  heroTagline: { color: "#d3cecb", marginTop: 16, marginBottom: 14, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  heroStaticPhotoArea: { flex: 0, flexShrink: 0, width: "100%", height: 370, minHeight: 370, minWidth: 0, alignItems: "center", justifyContent: "center" },
  heroStaticPhotoAreaMobile: { flex: 0, flexShrink: 0, width: "100%", height: 290, minHeight: 290, marginTop: 14 },
  heroStaticPhoto: { width: "100%", height: "100%", maxWidth: 420 },
  shortRule: { width: 50, height: 1, backgroundColor: "#ddd", marginBottom: 12 },
  bodyCopy: { color: "#bcb8b5", fontSize: 12, lineHeight: 20 },
  smallCopy: { fontSize: 10, lineHeight: 16 },
  price: { color: "#d5a472", fontSize: 18, fontWeight: "700", marginTop: 12, marginBottom: 13 },
  primaryButton: { backgroundColor: "#765036", paddingHorizontal: 18, paddingVertical: 12, alignSelf: "flex-start", borderRadius: 2 },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  smallButton: { paddingVertical: 10, paddingHorizontal: 16 },
  bottle: { width: 56, height: 225, borderRadius: 12, borderWidth: 1, borderColor: "#55463b", backgroundColor: "#070706", alignItems: "center", justifyContent: "flex-end", shadowColor: "#000", shadowOpacity: .45, shadowRadius: 15, elevation: 7 },
  bottleSmall: { width: 38, height: 168 },
  bottleNeck: { position: "absolute", top: -42, width: 25, height: 47, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: "#14100d", borderWidth: 1, borderColor: "#55463b" },
  bottleNeckSmall: { top: -31, width: 18, height: 35 },
  bottleLabel: { width: "78%", height: "40%", marginBottom: "16%", backgroundColor: "#e2ddd5", borderRadius: 2 },
  labelGold: { backgroundColor: "#d7c170" },
  labelOlive: { backgroundColor: "#e2ddc7" },
  productsSection: { paddingHorizontal: 34, paddingTop: 48, paddingBottom: 52, backgroundColor: "#100d0a" },
  productsSectionMobile: { paddingHorizontal: 18, paddingTop: 36, paddingBottom: 38 },
  emptyCatalog: { paddingVertical: 24, color: "#bcb8b5", fontSize: 12, lineHeight: 18, textAlign: "center" },
  sectionHeadingLine: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionHeadingLineMobile: { alignItems: "center", flexWrap: "wrap", rowGap: 10, marginBottom: 20 },
  catalogControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  catalogControlsMobile: { marginBottom: 15 },
  catalogFilters: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, padding: 3, borderWidth: 1, borderColor: "#49372a", borderRadius: 24, backgroundColor: "#15100c" },
  catalogFiltersMobile: { marginBottom: 0 },
  catalogFilterButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 19 },
  catalogFilterButtonActive: { backgroundColor: "#765036" },
  catalogFilterLabel: { color: "#c5b8aa", fontSize: 11, fontWeight: "600" },
  catalogFilterLabelActive: { color: "#fff", fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  sectionRule: { width: 52, height: 1, backgroundColor: "#d8c9b8" },
  sectionRuleMobile: { width: 32 },
  sectionTitle: { color: "#f2ece5", fontSize: 24, fontWeight: "700", letterSpacing: -.5 },
  sectionTitleMobile: { fontSize: 18, lineHeight: 23, flexShrink: 1 },
  arrows: { marginLeft: "auto", flexDirection: "row", gap: 8 },
  arrowsMobile: { marginLeft: "auto", gap: 6 },
  catalogArrows: { marginLeft: 12 },
  arrow: { width: 31, height: 31, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#8f7965", borderRadius: 18 },
  arrowMobile: { width: 27, height: 27 },
  arrowActive: { borderColor: "#805739", backgroundColor: "#805739" },
  productGrid: { flexDirection: "row", gap: 16 },
  productGridMobile: { flexDirection: "row", gap: 12, paddingRight: 18 },
  productCard: { height: 380, flex: 0, minWidth: 0, alignItems: "center", padding: 15, borderWidth: 1, borderColor: "#49372a", backgroundColor: "#19130f" },
  productCardMobile: { width: 245, height: 403, flex: 0, flexBasis: "auto", flexShrink: 0, padding: 14 },
  productCardDetails: { width: "100%", flex: 1, alignItems: "center" },
  cardTitle: { width: "100%", minHeight: 34, color: "#f2ece5", fontSize: 14, fontWeight: "700", textAlign: "center" },
  productBottle: { width: "100%", height: 160, alignItems: "center", justifyContent: "center", marginTop: 2 },
  productBottleMobile: { height: 210, justifyContent: "center" },
  productPhoto: { width: "100%", height: "100%" },
  productDescription: { height: 70, textAlign: "center", fontSize: 9, lineHeight: 14 },
  productDescriptionMobile: { height: 56 },
  stars: { color: "#d6b078", fontSize: 10, letterSpacing: 1, marginVertical: 8 },
  cardBottom: { width: "100%", minHeight: 36, marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  cardPriceBlock: { minWidth: 0, alignItems: "flex-start", gap: 2 },
  cardPrice: { color: "#d5a472", fontSize: 12, fontWeight: "700" },
  oldPrice: { color: "#9e9388", fontSize: 9, textDecorationLine: "line-through" },
  detailOldPrice: { marginTop: 13, color: "#9e9388", fontSize: 14, textDecorationLine: "line-through" },
  promotionBadge: { color: "#e7c18e", fontSize: 7, fontWeight: "800", letterSpacing: .7 },
  stockHint: { color: "#a99a8b", fontSize: 9 },
  tinyButton: { paddingHorizontal: 9, paddingVertical: 8 },
  tinyButtonText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  noResults: { color: "#aaa", textAlign: "center", padding: 20 },
  feature: { padding: 34, flexDirection: "row", alignItems: "center", gap: 34, backgroundColor: "#15100c" },
  featureMobile: { padding: 18, flexDirection: "column", alignItems: "stretch", gap: 22 },
  featureArt: { height: 240, flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#241a13", borderWidth: 1, borderColor: "#49372a" },
  featureArtMobile: { height: 220, flex: 0, flexBasis: "auto", flexShrink: 0, width: "100%" },
  featureCopy: { flex: 1, gap: 14 },
  featureCopyMobile: { flex: 0, flexBasis: "auto", flexShrink: 0, gap: 10 },
  featureTitle: { color: "#f3f0ee", fontSize: 27, lineHeight: 32, fontWeight: "800" },
  featureTitleMobile: { fontSize: 25, lineHeight: 30 },
  stats: { paddingVertical: 28, paddingHorizontal: 30, flexDirection: "row", justifyContent: "space-around", backgroundColor: "#0d0b09" },
  statsMobile: { paddingVertical: 18, paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  stat: { alignItems: "center", flex: 1 },
  statMobile: { width: "50%", flex: 0, flexBasis: "auto", flexShrink: 0, paddingVertical: 12 },
  statValue: { color: "#d0a06f", fontSize: 26, fontWeight: "800", marginBottom: 4 },
  statLabel: { color: "#e0dcda", fontSize: 9, fontWeight: "600", textAlign: "center" },
  testimonials: { paddingHorizontal: 34, paddingVertical: 38, backgroundColor: "#100d0a" },
  testimonialsMobile: { paddingHorizontal: 18, paddingVertical: 32 },
  quoteGrid: { flexDirection: "row", gap: 16 },
  quoteGridMobile: { flexDirection: "column", gap: 12 },
  quoteCard: { flex: 1, minHeight: 160, padding: 17, borderWidth: 1, borderColor: "#49372a", backgroundColor: "#19130f" },
  quoteCardMobile: { width: "100%", minHeight: 150, flex: 0 },
  quoteMark: { color: "#c18d5e", fontSize: 28, lineHeight: 30 },
  quoteCopy: { minHeight: 45, fontSize: 10 },
  quoteName: { color: "#bcb7b4", fontSize: 9, marginTop: 8 },
  redText: { color: "#c18d5e" },
  avatar: { width: 32, height: 32, borderRadius: 18, marginTop: 9, backgroundColor: "#694d39", borderWidth: 2, borderColor: "#b89a7c" },
  campaign: { minHeight: 410, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#120c08", position: "relative" },
  campaignMobile: { minHeight: 350, paddingVertical: 28 },
  campaignBottles: { ...StyleSheet.absoluteFillObject, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 26 },
  shadowBottle: { width: 60, height: 245, marginBottom: -28, borderWidth: 1, borderColor: "#382318", borderRadius: 14, backgroundColor: "#1e120c", opacity: .74 },
  shadowBottleCenter: { width: 72, height: 300, backgroundColor: "#21140d", transform: [{ rotate: "10deg" }] },
  shadowBottleRight: { transform: [{ rotate: "-6deg" }] },
  campaignYearSmall: { color: "#eee5da", fontSize: 19, fontWeight: "700", zIndex: 1 },
  campaignTitle: { color: "#eee5da", fontSize: 18, fontWeight: "700", zIndex: 1 },
  campaignYear: { color: "#f3ede5", fontSize: 112, fontWeight: "800", letterSpacing: -8, marginTop: 56, textShadowColor: "#000", textShadowRadius: 22, zIndex: 1 },
  campaignYearMobile: { fontSize: 76, letterSpacing: -5, marginTop: 48 },
  campaignYearSmallMobile: { fontSize: 63, letterSpacing: -4 },
  campaignBottle: { position: "absolute", top: 120, left: "53%", transform: [{ rotate: "28deg" }], zIndex: 2 },
  campaignBottleMobile: { top: 105, left: "56%", transform: [{ rotate: "28deg" }, { scale: .82 }] },
  cta: { minHeight: 105, paddingHorizontal: 34, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, backgroundColor: "#513321" },
  ctaMobile: { minHeight: 0, paddingHorizontal: 18, paddingVertical: 22, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 14 },
  ctaTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  ctaCopy: { color: "#fff", fontSize: 9 },
  ctaButton: { paddingHorizontal: 17, paddingVertical: 10, backgroundColor: "#fff" },
  ctaButtonText: { color: "#21170f", fontSize: 10, fontWeight: "700" },
  footer: { paddingHorizontal: 34, paddingTop: 36, paddingBottom: 28, flexDirection: "row", gap: 35, backgroundColor: "#2c1b12" },
  footerMobile: { paddingHorizontal: 18, paddingTop: 30, paddingBottom: 24, flexDirection: "row", flexWrap: "wrap", gap: 20 },
  footerColumn: { flex: 1, gap: 9 },
  footerAboutMobile: { width: "100%", flex: 0, flexBasis: "100%", flexShrink: 0 },
  footerColumnMobile: { width: "45%", flex: 1, minWidth: 0 },
  footerBrand: { color: "#f7f0ed", fontSize: 21, fontWeight: "700" },
  footerHeading: { color: "#f5efed", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  footerLink: { color: "#dfd0cd", fontSize: 10 },
  social: { color: "#f1e6e3", fontSize: 16, marginTop: 4 },
  copyright: { color: "#cbb7a2", paddingVertical: 10, textAlign: "center", borderTopWidth: 1, borderTopColor: "#61452f", backgroundColor: "#2c1b12", fontSize: 9 },
  panelPosition: { position: "absolute", bottom: 100, left: 16, right: 16, alignItems: "center", zIndex: 8 },
  cartScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: "stretch", paddingHorizontal: 18, backgroundColor: "#0d0b09" },
  cartContent: { flex: 1, width: "100%", alignSelf: "center" },
  cartContentWide: { maxWidth: 860 },
  cartScreenHeader: { minHeight: 76, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  cartBackButton: { position: "absolute", left: 0, zIndex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingRight: 6 },
  cartBackText: { color: "#d5a472", fontSize: 12, fontWeight: "600" },
  cartTitleRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  cartScreenTitle: { color: "#f3f1ef", fontSize: 16, fontWeight: "700" },
  cartCountPill: { position: "absolute", right: 0, minWidth: 23, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, overflow: "hidden", color: "#21170f", backgroundColor: "#d5a472", textAlign: "center", fontSize: 11, fontWeight: "700" },
  searchScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: "stretch", paddingHorizontal: 18, backgroundColor: "#0d0b09" },
  searchScreenContent: { flex: 1, width: "100%", alignSelf: "center" },
  searchScreenContentWide: { maxWidth: 860 },
  searchScreenHeader: { minHeight: 76, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  searchBackButton: { position: "absolute", left: 0, zIndex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  searchBackText: { color: "#d5a472", fontSize: 12, fontWeight: "600" },
  searchScreenTitle: { color: "#f3f1ef", fontSize: 18, fontWeight: "700" },
  searchPageBar: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 18, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "#61482f", borderRadius: 10, backgroundColor: "#15100c" },
  searchPageInput: { flex: 1, minWidth: 0, height: 48, color: "#fff", fontSize: 16, backgroundColor: "transparent", outlineStyle: "none" } as any,
  searchClearButton: { width: 34, height: 36, alignItems: "center", justifyContent: "center" },
  searchResultsScroll: { flex: 1 },
  searchResultsContent: { paddingTop: 6, paddingBottom: 24 },
  searchResultsCaption: { marginBottom: 14, color: "#a99a8b", fontSize: 11 },
  searchCategoryGroup: { marginBottom: 20 },
  searchCategoryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: "#49372a" },
  searchCategoryTitle: { color: "#f3f1ef", fontSize: 16, fontWeight: "700" },
  searchCategoryCount: { color: "#a99a8b", fontSize: 10 },
  searchProductRow: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#33271e" },
  searchProductDetails: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  searchProductImageWrap: { width: 66, height: 78, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, backgroundColor: "#18120e" },
  searchProductImage: { width: "100%", height: "100%" },
  searchBottleFallback: { height: 80, overflow: "hidden", alignItems: "center", justifyContent: "center", transform: [{ scale: .43 }] },
  searchProductInfo: { flex: 1, minWidth: 0, gap: 4, alignItems: "flex-start" },
  searchProductName: { color: "#f3f1ef", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  searchProductDescription: { fontSize: 10, lineHeight: 14 },
  searchProductPrice: { color: "#d5a472", fontSize: 12, fontWeight: "700" },
  searchAddButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "#765036" },
  searchAddButtonText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  searchEmpty: { paddingVertical: 30, color: "#bcb8b5", fontSize: 12, lineHeight: 19, textAlign: "center" },
  productDetailScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, alignItems: "stretch", paddingHorizontal: 18, backgroundColor: "#0d0b09" },
  productDetailContent: { flex: 1, width: "100%", alignSelf: "center" },
  productDetailContentWide: { maxWidth: 980 },
  productDetailHeader: { minHeight: 70, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  productDetailBack: { position: "absolute", left: 0, zIndex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 8 },
  productDetailBackText: { color: "#d5a472", fontSize: 13, fontWeight: "600" },
  productDetailHeaderTitle: { color: "#f3f1ef", fontSize: 16, fontWeight: "700" },
  productDetailScroll: { flex: 1 },
  productDetailBody: { flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 34, paddingVertical: 28 },
  productDetailBodyMobile: { flexDirection: "column", alignItems: "flex-start", gap: 20, paddingTop: 16, paddingBottom: 24 },
  productDetailHero: { height: 470, flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 12, backgroundColor: "#17110d" },
  productDetailHeroMobile: { height: 300, minHeight: 300, flex: 0, flexGrow: 0, flexShrink: 0, alignSelf: "stretch", width: "100%", borderRadius: 10 },
  productDetailImage: { width: "100%", height: "100%", flexShrink: 0 },
  productDetailBottle: { height: 270, alignItems: "center", justifyContent: "center", transform: [{ scale: 1.5 }] },
  productDetailInfo: { flex: 1, minWidth: 0, alignItems: "flex-start", paddingVertical: 14 },
  productDetailCategory: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "#2b1e14" },
  productDetailCategoryText: { color: "#d5a472", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  productDetailName: { marginTop: 16, color: "#f3f1ef", fontSize: 26, lineHeight: 32, fontWeight: "800" },
  productDetailSubtitle: { marginTop: 5, color: "#bcb8b5", fontSize: 13 },
  productDetailPrice: { marginTop: 15, color: "#d5a472", fontSize: 22, fontWeight: "800" },
  productDetailDivider: { width: "100%", height: 1, marginTop: 23, marginBottom: 20, backgroundColor: "#49372a" },
  productDetailSectionTitle: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  productDetailDescription: { marginTop: 9, color: "#c4bbb2", fontSize: 13, lineHeight: 21 },
  productDetailQuantityRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 28, paddingTop: 19, borderTopWidth: 1, borderTopColor: "#33271e" },
  productDetailQuantityHint: { marginTop: 4, color: "#9e9388", fontSize: 10 },
  productDetailQuantityControl: { height: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 5, borderWidth: 1, borderColor: "#49372a", borderRadius: 22 },
  productDetailQuantityButton: { width: 32, height: 34, alignItems: "center", justifyContent: "center" },
  productDetailQuantityButtonDisabled: { opacity: .4 },
  productDetailQuantity: { minWidth: 18, color: "#f3f1ef", textAlign: "center", fontSize: 13, fontWeight: "700" },
  productDetailFooter: { flexDirection: "row", alignItems: "center", gap: 18, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#49372a", backgroundColor: "#0d0b09" },
  productDetailTotal: { minWidth: 100, gap: 3 },
  productDetailTotalLabel: { color: "#a99a8b", fontSize: 10 },
  productDetailTotalValue: { color: "#d5a472", fontSize: 17, fontWeight: "800" },
  productDetailAddButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18, borderRadius: 7, backgroundColor: "#765036" },
  productDetailAddText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cartEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 45 },
  cartEmptyIcon: { width: 68, height: 68, alignItems: "center", justifyContent: "center", marginBottom: 20, borderRadius: 34, backgroundColor: "#211912" },
  cartEmptyTitle: { color: "#f3f1ef", fontSize: 21, fontWeight: "700", textAlign: "center" },
  cartEmptyCopy: { maxWidth: 330, marginTop: 9, marginBottom: 22, color: "#bcb8b5", fontSize: 13, lineHeight: 20, textAlign: "center" },
  cartItemsScroll: { flex: 1 },
  cartItemsContent: { paddingBottom: 18 },
  cartSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 5 },
  cartSectionTitle: { color: "#f3f1ef", fontSize: 16, fontWeight: "700" },
  cartSectionMeta: { color: "#bcb8b5", fontSize: 12 },
  cartProductRow: { minHeight: 130, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#33271e" },
  cartProductImageWrap: { width: 76, height: 92, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, backgroundColor: "#18120e" },
  cartProductImage: { width: "100%", height: "100%" },
  cartBottleFallback: { height: 82, overflow: "hidden", alignItems: "center", justifyContent: "center", transform: [{ scale: .48 }] },
  cartProductInfo: { flex: 1, minWidth: 0, gap: 4, alignItems: "flex-start" },
  cartProductName: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  cartProductLabel: { color: "#a99a8b", fontSize: 9, letterSpacing: 1 },
  cartProductPrice: { color: "#d5a472", fontSize: 13, fontWeight: "700" },
  cartLineTotal: { color: "#bcb8b5", fontSize: 10 },
  cartQuantityControl: { height: 34, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, paddingHorizontal: 5, borderWidth: 1, borderColor: "#49372a", borderRadius: 18 },
  cartQuantityButton: { width: 28, height: 30, alignItems: "center", justifyContent: "center" },
  cartQuantity: { minWidth: 15, color: "#f3f1ef", textAlign: "center", fontSize: 12, fontWeight: "600" },
  cartDeleteButton: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  cartNotesBlock: { gap: 9, marginTop: 22 },
  cartCheckoutFields: { gap: 9, marginTop: 22 },
  checkoutTextInput: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: "#49372a", borderRadius: 8, color: "#fff", backgroundColor: "#15100c", fontSize: 16 },
  checkoutError: { color: "#e7a080", fontSize: 11, lineHeight: 16 },
  checkoutButtonDisabled: { opacity: .55 },
  cartNotesLabel: { color: "#e9e0d6", fontSize: 12, fontWeight: "600" },
  cartOptional: { color: "#9e9388", fontSize: 10, fontWeight: "400" },
  cartNotesInput: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#49372a", borderRadius: 8, color: "#fff", backgroundColor: "#15100c", fontSize: 12, textAlignVertical: "top" },
  cartSummary: { gap: 10, paddingTop: 15, paddingBottom: 11, borderTopWidth: 1, borderTopColor: "#49372a", backgroundColor: "#0d0b09" },
  cartSummaryLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cartSummaryLabel: { color: "#bcb8b5", fontSize: 12 },
  cartSummaryValue: { color: "#f3f1ef", fontSize: 12, fontWeight: "600" },
  cartTotalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 9, borderTopWidth: 1, borderTopColor: "#33271e" },
  cartTotalLabel: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  cartTotalValue: { color: "#d5a472", fontSize: 18, fontWeight: "800" },
  cartPriceDisclaimer: { color: "#cbb7a2", fontSize: 10, lineHeight: 15 },
  cartPrimaryButton: { width: "100%", minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 6, backgroundColor: "#765036" },
  cartPrimaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  cartCheckoutHint: { color: "#9e9388", fontSize: 10, lineHeight: 14, textAlign: "center" },
  comandaScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 35, alignItems: "stretch", paddingHorizontal: 18, backgroundColor: "#0d0b09" },
  comandaContent: { flex: 1, width: "100%", alignSelf: "center" },
  comandaContentWide: { maxWidth: 760 },
  comandaHeader: { minHeight: 76, position: "relative", flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  comandaBack: { position: "absolute", left: 0, zIndex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  comandaBackText: { color: "#d5a472", fontSize: 12, fontWeight: "600" },
  comandaHeaderTitle: { alignItems: "center", gap: 2 },
  comandaTitle: { color: "#f3f1ef", fontSize: 18, fontWeight: "700" },
  comandaSubtitle: { color: "#a99a8b", fontSize: 10 },
  comandaScroll: { flex: 1 },
  comandaBody: { gap: 15, paddingVertical: 17, paddingBottom: 26 },
  comandaOrderHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: "#33271e" },
  comandaOrderNumber: { color: "#f3f1ef", fontSize: 15, fontWeight: "800" },
  comandaOrderMeta: { marginTop: 4, color: "#bcb8b5", fontSize: 10 },
  comandaStatus: { maxWidth: 150, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: "#775536", borderRadius: 14, backgroundColor: "#211810" },
  comandaStatusText: { color: "#d5a472", fontSize: 8, fontWeight: "700", textAlign: "center", letterSpacing: .3 },
  comandaSection: { gap: 11, padding: 14, borderWidth: 1, borderColor: "#33271e", borderRadius: 10, backgroundColor: "#120e0b" },
  comandaSectionTitle: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  comandaItem: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#2a211a" },
  comandaItemInfo: { flex: 1, gap: 3 },
  comandaItemName: { color: "#eee5da", fontSize: 11, fontWeight: "600" },
  comandaItemUnit: { color: "#95897e", fontSize: 9 },
  comandaItemTotal: { color: "#d5a472", fontSize: 11, fontWeight: "700" },
  comandaNotes: { color: "#bcb8b5", fontSize: 10, lineHeight: 15 },
  comandaTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 5 },
  comandaTotalLabel: { color: "#f3f1ef", fontSize: 12, fontWeight: "700" },
  comandaTotalValue: { color: "#d5a472", fontSize: 18, fontWeight: "800" },
  pixCard: { gap: 11, padding: 14, borderWidth: 1, borderColor: "#775536", borderRadius: 10, backgroundColor: "#1b140e" },
  pixInstructions: { color: "#c4bbb2", fontSize: 10, lineHeight: 16 },
  pixKeyRow: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 11, paddingRight: 5, borderWidth: 1, borderColor: "#49372a", borderRadius: 8, backgroundColor: "#100d0a" },
  pixKeyText: { flex: 1, color: "#f3f1ef", fontSize: 12, fontWeight: "600" },
  pixCopyButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#2b2118" },
  pixCopyText: { color: "#d5a472", fontSize: 10, fontWeight: "700" },
  pixAccountHint: { color: "#978a7e", fontSize: 9 },
  receiptCard: { gap: 10, padding: 14, borderWidth: 1, borderColor: "#33271e", borderRadius: 10, backgroundColor: "#120e0b" },
  receiptInstructions: { color: "#c4bbb2", fontSize: 10, lineHeight: 16 },
  receiptChooseButton: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#775536", borderRadius: 7 },
  receiptChooseButtonText: { color: "#d5a472", fontSize: 11, fontWeight: "700" },
  receiptPreview: { gap: 9, alignItems: "center", padding: 10, borderRadius: 8, backgroundColor: "#0d0b09" },
  receiptPreviewImage: { width: "100%", height: 230 },
  receiptFileName: { width: "100%", color: "#bcb8b5", fontSize: 9, textAlign: "center" },
  receiptSubmitButton: { width: "100%", minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: "#765036" },
  receiptSubmitText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  receiptSaved: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#211810" },
  receiptSavedText: { flex: 1, color: "#d5a472", fontSize: 10 },
  receiptDisclaimer: { color: "#9e9388", fontSize: 9, lineHeight: 14 },
  comandaFooter: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#49372a", backgroundColor: "#0d0b09" },
  comandaFooterHint: { color: "#9e9388", fontSize: 10, lineHeight: 16, textAlign: "center" },
  comandaPrimaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 7, backgroundColor: "#765036" },
  comandaPrimaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  comandaLoading: { marginTop: 30, color: "#c4bbb2", fontSize: 12, textAlign: "center" },
  comandaErrorState: { flex: 1, justifyContent: "center", gap: 16 },
  comandaErrorText: { color: "#e7a080", fontSize: 12, lineHeight: 18, textAlign: "center" },
  finalOrderScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 36, alignItems: "stretch", paddingHorizontal: 18, backgroundColor: "#0d0b09" },
  finalOrderContent: { flex: 1, width: "100%", alignSelf: "center" },
  finalOrderHeader: { minHeight: 76, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#49372a" },
  finalOrderTitle: { color: "#f3f1ef", fontSize: 18, fontWeight: "700" },
  finalOrderScroll: { flex: 1 },
  finalOrderBody: { gap: 20, paddingTop: 20, paddingBottom: 28 },
  finalOrderItems: { gap: 2 },
  finalOrderItem: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#33271e" },
  finalOrderItemName: { flex: 1, color: "#f3f1ef", fontSize: 12, fontWeight: "600" },
  finalOrderTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 7 },
  finalOrderTotalLabel: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  finalOrderTotalValue: { color: "#d5a472", fontSize: 20, fontWeight: "800" },
  finalOrderProof: { gap: 11, paddingTop: 8 },
  finalOrderProofTitle: { color: "#f3f1ef", fontSize: 13, fontWeight: "700" },
  finalOrderProofImage: { width: "100%", height: 360, borderRadius: 8, backgroundColor: "#17110d" },
  finalOrderProofMissing: { color: "#bcb8b5", fontSize: 11 },
  settingsScreen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: "stretch", paddingHorizontal: 22, backgroundColor: "#0d0b09" },
  settingsScreenPanel: { flex: 1, width: "100%", maxWidth: 980, alignSelf: "center", paddingTop: 18, paddingBottom: 16 },
  settingsScreenHeader: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 18, paddingBottom: 17, marginBottom: 18, borderBottomWidth: 1, borderBottomColor: "#49372a" },
  settingsBackButton: { minWidth: 58, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3, paddingRight: 7 },
  settingsBackArrow: { width: 18, height: 27, color: "#d5a472", fontSize: 25, lineHeight: 27, textAlign: "center", textAlignVertical: "center" },
  settingsBackText: { color: "#d5a472", fontSize: 11, lineHeight: 27, fontWeight: "600" },
  settingsScreenHeadingCopy: { flex: 1 },
  settingsScreenTitle: { color: "#f3f1ef", fontSize: 23, lineHeight: 28, fontWeight: "700" },
  settingsScreenSubtitle: { color: "#bcb8b5", fontSize: 11, marginTop: 3 },
  panel: { width: "100%", maxWidth: 440, padding: 18, borderWidth: 1, borderColor: "#62482f", borderRadius: 15, backgroundColor: "#1b140e", shadowColor: "#000", shadowOpacity: .5, shadowRadius: 24, elevation: 12 },
  panelHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  panelTitle: { color: "#f3f1ef", fontSize: 17, fontWeight: "700" },
  panelClose: { color: "#eee", fontSize: 27, lineHeight: 30, paddingHorizontal: 7 },
  panelHint: { color: "#aaa", fontSize: 11, marginTop: 11 },
  searchInput: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: "#61482f", borderRadius: 7, color: "#fff", backgroundColor: "#100d0a" },
  cartList: { gap: 10 },
  cartItem: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#463528" },
  cartItemName: { color: "#eee", fontSize: 12 },
  removeItem: { color: "#d2a678", fontSize: 11 },
  settingLabel: { color: "#ddd", fontSize: 12 },
  productCategoryOptions: { flexDirection: "row", gap: 8, marginBottom: 3 },
  productCategoryOption: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#61482f", borderRadius: 7 },
  productCategoryOptionActive: { borderColor: "#d5a472", backgroundColor: "#765036" },
  productCategoryOptionText: { color: "#eee5da", fontSize: 11, fontWeight: "600" },
  descriptionInput: { minHeight: 76, paddingTop: 11, textAlignVertical: "top" },
  adminScroll: { maxHeight: 420 },
  adminScrollFull: { flex: 1, maxHeight: "100%" },
  adminForm: { gap: 9, paddingBottom: 4 },
  adminHint: { color: "#cbb7a2", fontSize: 11, lineHeight: 17, marginBottom: 3 },
  adminAccess: { gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: "#61482f", borderRadius: 9, backgroundColor: "#15100c" },
  adminFeedback: { color: "#d5a472", fontSize: 10, lineHeight: 15 },
  adminProductList: { gap: 5 },
  adminSection: { gap: 4, padding: 12, borderWidth: 1, borderColor: "#463528", borderRadius: 9, backgroundColor: "#15100c" },
  adminSectionTitle: { color: "#f2ece5", fontSize: 13, fontWeight: "700" },
  adminSectionHint: { color: "#bcb8b5", fontSize: 10, lineHeight: 15 },
  adminEmpty: { color: "#a69b90", fontSize: 10, paddingVertical: 8 },
  adminProductRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#463528" },
  adminProductInfo: { flex: 1, minWidth: 0 },
  adminProductName: { color: "#f2ece5", fontSize: 12, fontWeight: "600" },
  adminProductMeta: { color: "#bcb8b5", fontSize: 8, marginTop: 3 },
  adminActionLink: { paddingHorizontal: 5, paddingVertical: 8 },
  adminActionText: { color: "#d5a472", fontSize: 10, fontWeight: "700" },
  deleteActionText: { color: "#cbb7a2", fontSize: 10 },
  adminDisabled: { opacity: 0.4 },
  adminButtonDisabled: { opacity: 0.45 },
  createProductButton: { marginTop: 10 },
  adminActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 },
  secondaryButton: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#61482f", borderRadius: 2 },
  secondaryButtonText: { color: "#e3d6c8", fontSize: 11 },
  formError: { color: "#edbb91", fontSize: 10 },
  navPosition: { position: "absolute", right: 0, bottom: 13, left: 0, alignItems: "center", zIndex: 10 },
  navSurface: { width: "70%", maxWidth: 510, minHeight: 60, padding: 5, borderWidth: 1, borderColor: "rgba(210,178,145,0.25)", borderRadius: 20, backgroundColor: "rgba(27,19,14,0.9)", shadowColor: "#000", shadowOpacity: .4, shadowRadius: 20, elevation: 13 },
  navItems: { flex: 1, flexDirection: "row", alignItems: "stretch", justifyContent: "space-around" },
  navItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 1, borderRadius: 15, backgroundColor: "transparent" },
  navLabel: { maxWidth: "100%", flexShrink: 1, color: "#c9c0b7", fontSize: 9, fontWeight: "500", textAlign: "center" },
  navLabelActive: { color: "#d7ad7d" },
  badge: { position: "absolute", top: 1, right: "22%", minWidth: 17, height: 17, overflow: "hidden", borderRadius: 9, backgroundColor: "#805739", color: "#fff", fontSize: 9, lineHeight: 17, textAlign: "center" },
});

export default App;
