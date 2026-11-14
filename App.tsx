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
import { ArrowLeft, ChevronLeft, ChevronRight, House, Minus, Plus, Search, ShoppingBag, ShoppingCart, Settings, Trash2, X } from "lucide-react-native";

type PanelName = "search" | "cart" | "settings" | null;
type Product = { id: string; name: string; label: string; price: string; description: string; tone: string; imageUrl?: string };

const HERO_IMAGE_URL = "https://r2.fivemanage.com/vLUsF9vzqBOo7DSFHERFX/CestadeVinhosMattoChals.png";

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

const navItems = [
  { id: "home", label: "Início", Icon: House },
  { id: "search", label: "Buscar", Icon: Search },
  { id: "cart", label: "Carrinho", Icon: ShoppingCart },
  { id: "settings", label: "Configurações", Icon: Settings },
] as const;

const webGlassStyle = Platform.OS === "web"
  ? ({
      backgroundColor: "rgba(27, 19, 14, 0.76)",
      backdropFilter: "blur(22px) saturate(150%)",
      WebkitBackdropFilter: "blur(22px) saturate(150%)",
    } as ViewStyle)
  : undefined;

function BodyCopy({ children = "...", style }: { children?: React.ReactNode; style?: object }) {
  return <Text style={[styles.bodyCopy, style]}>{children}</Text>;
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
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const isMobile = viewportWidth <= 680;
  const isSmallMobile = viewportWidth <= 390;
  const [panel, setPanel] = useState<PanelName>(null);
  const [active, setActive] = useState("home");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState("");
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
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productTone, setProductTone] = useState("ivory");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productFormError, setProductFormError] = useState("");

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
    const normalized = query.trim().toLocaleLowerCase();
    return products.filter((product) => product.name.toLocaleLowerCase().includes(normalized));
  }, [products, query]);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartRows = Object.entries(cart).map(([name, quantity]) => {
    const product = products.find((item) => item.name === name);
    const unitPrice = parsePrice(product?.price);
    return { name, quantity, product, unitPrice, lineTotal: unitPrice === null ? null : unitPrice * quantity };
  });
  const cartSubtotal = cartRows.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const hasUnpricedItems = cartRows.some((item) => item.lineTotal === null);

  function addToCart(name: string) {
    setCart((current) => ({ ...current, [name]: (current[name] ?? 0) + 1 }));
    setActive("cart");
    setPanel("cart");
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
      return { ...current, [name]: nextQuantity };
    });
  }

  function sendOrderToWhatsApp() {
    const lines = cartRows.map(({ name, quantity, lineTotal }) => `• ${quantity}x ${name} — ${lineTotal === null ? "preço a confirmar" : formatPrice(lineTotal)}`);
    const message = [
      "Olá! Gostaria de fazer este pedido na Matto Chalés:",
      "",
      ...lines,
      "",
      `Subtotal: ${formatPrice(cartSubtotal)}${hasUnpricedItems ? " (há itens com preço a confirmar)" : ""}`,
      "Entrega: a combinar",
      orderNotes.trim() ? `Observações: ${orderNotes.trim()}` : "",
    ].filter(Boolean).join("\n");
    void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => undefined);
  }

  function openProductForm(product?: Product) {
    setEditingProductId(product?.id ?? null);
    setProductName(product?.name ?? "");
    setProductLabel(product?.label ?? "");
    setProductPrice(product?.price === "..." ? "" : product?.price ?? "");
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
    const product: Product = {
      id: editingProductId ?? `product-${Date.now()}`,
      name,
      label,
      price: productPrice.trim(),
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
    <View style={[styles.productCard, isMobile && styles.productCardMobile]} key={product.id}>
      <Text style={styles.cardTitle}>{product.label}</Text>
      <View style={[styles.productBottle, isMobile && styles.productBottleMobile]}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.productPhoto} resizeMode="contain" accessibilityLabel={`Foto de ${product.name}`} /> : <WineBottle tone={product.tone} small />}</View>
      <BodyCopy style={styles.productDescription}>{product.description}</BodyCopy>
      <Text style={styles.stars}>★★★★★</Text>
      <View style={styles.cardBottom}><Text style={styles.cardPrice}>{product.price}</Text><Pressable onPress={() => addToCart(product.name)} style={[styles.primaryButton, styles.tinyButton]}><Text style={styles.tinyButtonText}>Adicionar à Sacola</Text></Pressable></View>
    </View>
  ));
  const renderAdminProductRows = (items: Product[]) => items.length
    ? <View style={styles.adminProductList}>{items.map((product) => <View style={styles.adminProductRow} key={product.id}><View style={styles.adminProductInfo}><Text style={styles.adminProductName}>{product.name}</Text><Text style={styles.adminProductMeta}>{product.label} · {product.price}</Text></View><Pressable disabled={!canManageProducts} onPress={() => openProductForm(product)} style={styles.adminActionLink}><Text style={[styles.adminActionText, !canManageProducts && styles.adminDisabled]}>Editar</Text></Pressable><Pressable disabled={!canManageProducts} accessibilityLabel={`Excluir ${product.name}`} onPress={() => deleteProduct(product)} style={styles.adminActionLink}><Text style={[styles.deleteActionText, !canManageProducts && styles.adminDisabled]}>Excluir</Text></Pressable></View>)}</View>
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

            {panel === "search" && <View style={[styles.expandedSearch, isMobile && styles.expandedSearchMobile]}>
              <Search size={18} color="#c18d5e" strokeWidth={2} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar vinhos e bebidas..." placeholderTextColor="#9e9388" style={styles.expandedSearchInput} autoFocus accessibilityLabel="Buscar produtos" returnKeyType="search" />
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar busca" onPress={() => { setPanel(null); setActive("home"); }} style={styles.expandedSearchClose}><X size={18} color="#c9c0b7" /></Pressable>
            </View>}

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
              <View style={[styles.sectionHeadingLine, isMobile && styles.sectionHeadingLineMobile]}><SectionTitle compact={isMobile}>NOSSOS PRODUTOS</SectionTitle><View style={[styles.arrows, isMobile && styles.arrowsMobile]}><View style={[styles.arrow, isMobile && styles.arrowMobile]}><ChevronLeft size={15} color="#f2ece5" strokeWidth={2} /></View><View style={[styles.arrow, styles.arrowActive, isMobile && styles.arrowMobile]}><ChevronRight size={15} color="#f2ece5" strokeWidth={2} /></View></View></View>
              {isMobile
                ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productGridMobile}>{productCards}</ScrollView>
                : <View style={styles.productGrid}>{productCards}</View>}
              {products.length === 0 && query.length === 0 && <Text style={styles.emptyCatalog}>Nenhum produto cadastrado. Cadastre novos produtos em Configurações.</Text>}
              {query.length > 0 && shownProducts.length === 0 && <Text style={styles.noResults}>Nenhum vinho encontrado.</Text>}
            </View>

            <View style={[styles.footer, isMobile && styles.footerMobile]}>
              <View style={[styles.footerColumn, isMobile && styles.footerAboutMobile]}><Text style={styles.footerBrand}>Matto Chalés</Text><BodyCopy>...</BodyCopy><Text style={styles.social}>◉  ◎  ◌  ◉</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>LINKS RÁPIDOS</Text><Text style={styles.footerLink}>Início</Text><Text style={styles.footerLink}>Produtos</Text><Text style={styles.footerLink}>Contato</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>CONTATO</Text><Text style={styles.footerLink}>⌖  ...</Text><Text style={styles.footerLink}>☎  ...</Text><Text style={styles.footerLink}>✉  ...</Text></View>
            </View>
            <Text style={styles.copyright}>...</Text>
          </View>
        </ScrollView>

        {panel === "cart" && <View style={[styles.cartScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.cartContent, !isMobile && styles.cartContentWide]}>
            <View style={styles.cartScreenHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={() => { setPanel(null); setActive("home"); }} style={styles.cartBackButton}><ArrowLeft size={20} color="#d5a472" /><Text style={styles.cartBackText}>Continuar comprando</Text></Pressable>
              <View style={styles.cartTitleRow}><ShoppingBag size={21} color="#d5a472" /><Text style={styles.cartScreenTitle}>Sua sacola</Text>{cartCount > 0 && <Text style={styles.cartCountPill}>{cartCount}</Text>}</View>
            </View>

            {cartRows.length === 0 ? <View style={styles.cartEmpty}>
              <View style={styles.cartEmptyIcon}><ShoppingBag size={31} color="#c18d5e" /></View>
              <Text style={styles.cartEmptyTitle}>Sua sacola está vazia</Text>
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
                    <Text style={styles.cartProductPrice}>{unitPrice === null ? "Preço a confirmar" : formatPrice(unitPrice)}</Text>
                    {lineTotal !== null && quantity > 1 && <Text style={styles.cartLineTotal}>Total: {formatPrice(lineTotal)}</Text>}
                    <View style={styles.cartQuantityControl}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Diminuir quantidade de ${name}`} onPress={() => changeCartQuantity(name, -1)} style={styles.cartQuantityButton}><Minus size={15} color="#eee5da" /></Pressable>
                      <Text style={styles.cartQuantity}>{quantity}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Aumentar quantidade de ${name}`} onPress={() => changeCartQuantity(name, 1)} style={styles.cartQuantityButton}><Plus size={15} color="#eee5da" /></Pressable>
                    </View>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${name} da sacola`} onPress={() => removeFromCart(name)} style={styles.cartDeleteButton}><Trash2 size={17} color="#b8a18c" /></Pressable>
                </View>)}
                <View style={styles.cartNotesBlock}><Text style={styles.cartNotesLabel}>Observações para a loja <Text style={styles.cartOptional}>(opcional)</Text></Text><TextInput value={orderNotes} onChangeText={setOrderNotes} placeholder="Alguma preferência para este pedido?" placeholderTextColor="#94877b" multiline style={styles.cartNotesInput} accessibilityLabel="Observações para a loja" /></View>
              </ScrollView>

              <View style={styles.cartSummary}>
                <View style={styles.cartSummaryLine}><Text style={styles.cartSummaryLabel}>Subtotal</Text><Text style={styles.cartSummaryValue}>{formatPrice(cartSubtotal)}{hasUnpricedItems ? "*" : ""}</Text></View>
                <View style={styles.cartSummaryLine}><Text style={styles.cartSummaryLabel}>Entrega</Text><Text style={styles.cartSummaryValueMuted}>A combinar</Text></View>
                <View style={styles.cartTotalLine}><Text style={styles.cartTotalLabel}>{hasUnpricedItems ? "Subtotal parcial" : "Total dos produtos"}</Text><Text style={styles.cartTotalValue}>{formatPrice(cartSubtotal)}{hasUnpricedItems ? "*" : ""}</Text></View>
                {hasUnpricedItems && <Text style={styles.cartPriceDisclaimer}>* O preço de um ou mais itens será confirmado pela loja.</Text>}
                <Pressable onPress={sendOrderToWhatsApp} style={styles.cartPrimaryButton}><Text style={styles.cartPrimaryButtonText}>Enviar pedido pelo WhatsApp</Text></Pressable>
                <Text style={styles.cartCheckoutHint}>Você combinará entrega e pagamento diretamente com a loja.</Text>
              </View>
            </>}
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
                  <Text style={styles.settingLabel}>Preço</Text>
                  <TextInput value={productPrice} onChangeText={setProductPrice} placeholder="Ex.: R$ 89,90" placeholderTextColor="#9e9388" style={styles.searchInput} />
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
  hero: { minHeight: 0, paddingHorizontal: 34, paddingVertical: 48, backgroundColor: "#18110d", flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 18, position: "relative", overflow: "hidden" },
  heroMobile: { minHeight: 0, paddingHorizontal: 18, paddingTop: 36, paddingBottom: 28, flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 0 },
  heroCopy: { flex: 0, zIndex: 2 },
  heroCopyMobile: { flex: 0, flexBasis: "auto", flexShrink: 0 },
  heroTitle: { color: "#f5f2f0", fontSize: 57, lineHeight: 62, fontWeight: "800", letterSpacing: -2 },
  heroTitleMobile: { fontSize: 43, lineHeight: 47, letterSpacing: -1.5 },
  heroTitleSmall: { fontSize: 37, lineHeight: 41 },
  heroTagline: { color: "#d3cecb", marginTop: 16, marginBottom: 14, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  heroStaticPhotoArea: { flex: 0, width: "100%", height: 370, minWidth: 0, alignItems: "center", justifyContent: "center" },
  heroStaticPhotoAreaMobile: { flex: 0, width: "100%", height: 290, marginTop: 14 },
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
  sectionHeadingLine: { flexDirection: "row", alignItems: "center", marginBottom: 25 },
  sectionHeadingLineMobile: { alignItems: "center", flexWrap: "wrap", rowGap: 10, marginBottom: 20 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  sectionRule: { width: 52, height: 1, backgroundColor: "#d8c9b8" },
  sectionRuleMobile: { width: 32 },
  sectionTitle: { color: "#f2ece5", fontSize: 24, fontWeight: "700", letterSpacing: -.5 },
  sectionTitleMobile: { fontSize: 18, lineHeight: 23, flexShrink: 1 },
  arrows: { marginLeft: "auto", flexDirection: "row", gap: 8 },
  arrowsMobile: { marginLeft: "auto", gap: 6 },
  arrow: { width: 31, height: 31, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#8f7965", borderRadius: 18 },
  arrowMobile: { width: 27, height: 27 },
  arrowActive: { borderColor: "#805739", backgroundColor: "#805739" },
  productGrid: { flexDirection: "row", gap: 16 },
  productGridMobile: { flexDirection: "row", gap: 12, paddingRight: 18 },
  productCard: { flex: 1, minWidth: 0, alignItems: "center", padding: 15, borderWidth: 1, borderColor: "#49372a", backgroundColor: "#19130f" },
  productCardMobile: { width: 245, flex: 0, flexBasis: "auto", flexShrink: 0, padding: 14 },
  cardTitle: { minHeight: 34, color: "#f2ece5", fontSize: 14, fontWeight: "700", textAlign: "center" },
  productBottle: { width: "100%", height: 160, alignItems: "center", justifyContent: "center", marginTop: 2 },
  productBottleMobile: { height: 210, justifyContent: "center" },
  productPhoto: { width: "100%", height: "100%" },
  productDescription: { minHeight: 40, textAlign: "center", fontSize: 9, lineHeight: 14 },
  stars: { color: "#d6b078", fontSize: 10, letterSpacing: 1, marginVertical: 8 },
  cardBottom: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  cardPrice: { color: "#d5a472", fontSize: 12, fontWeight: "700" },
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
  cartScreenHeader: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#49372a" },
  cartBackButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  cartBackText: { color: "#d5a472", fontSize: 12, fontWeight: "600" },
  cartTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  cartScreenTitle: { color: "#f3f1ef", fontSize: 21, fontWeight: "700" },
  cartCountPill: { minWidth: 23, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, overflow: "hidden", color: "#21170f", backgroundColor: "#d5a472", textAlign: "center", fontSize: 11, fontWeight: "700" },
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
  cartNotesLabel: { color: "#e9e0d6", fontSize: 12, fontWeight: "600" },
  cartOptional: { color: "#9e9388", fontSize: 10, fontWeight: "400" },
  cartNotesInput: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#49372a", borderRadius: 8, color: "#fff", backgroundColor: "#15100c", fontSize: 12, textAlignVertical: "top" },
  cartSummary: { gap: 10, paddingTop: 15, paddingBottom: 11, borderTopWidth: 1, borderTopColor: "#49372a", backgroundColor: "#0d0b09" },
  cartSummaryLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cartSummaryLabel: { color: "#bcb8b5", fontSize: 12 },
  cartSummaryValue: { color: "#f3f1ef", fontSize: 12, fontWeight: "600" },
  cartSummaryValueMuted: { color: "#d5a472", fontSize: 11 },
  cartTotalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 9, borderTopWidth: 1, borderTopColor: "#33271e" },
  cartTotalLabel: { color: "#f3f1ef", fontSize: 14, fontWeight: "700" },
  cartTotalValue: { color: "#d5a472", fontSize: 18, fontWeight: "800" },
  cartPriceDisclaimer: { color: "#cbb7a2", fontSize: 10, lineHeight: 15 },
  cartPrimaryButton: { width: "100%", minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 6, backgroundColor: "#765036" },
  cartPrimaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  cartCheckoutHint: { color: "#9e9388", fontSize: 10, lineHeight: 14, textAlign: "center" },
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
