import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Search, ShoppingCart, Settings } from "lucide-react-native";

type PanelName = "search" | "cart" | "settings" | null;
type Product = { id: string; name: string; label: string; price: string; description: string; tone: string; imageUrl?: string };

const initialProducts: Product[] = [
  { id: "sparkling-wine", name: "Sparkling wine", label: "SPARKLING WINE", price: "R$ 89,90", description: "Espumante selecionado para brindar bons momentos.", tone: "gold" },
  { id: "fortified-wine", name: "Fortified wine", label: "FORTIFIED WINE", price: "R$ 119,90", description: "Vinho encorpado, com aroma marcante e final elegante.", tone: "ivory" },
  { id: "aromatized-wine", name: "Aromatized wine", label: "AROMATIZED WINE", price: "R$ 69,90", description: "Uma bebida aromática para apreciar em boa companhia.", tone: "olive" },
];

const HERO_IMAGE_URL = "https://r2.fivemanage.com/vLUsF9vzqBOo7DSFHERFX/CestadeVinhosMattoChals.png";

const navItems = [
  { id: "home", label: "Home", Icon: House },
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
  const [products, setProducts] = useState(initialProducts);
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
  }, [query]);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

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
    setActive(id);
    if (id === "home") {
      setPanel(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setPanel((current) => current === id ? null : id as PanelName);
  }

  const pageStyle = [styles.page, isMobile && styles.pageMobile];
  const panelStyle = styles.panel;
  const canManageProducts = databaseMode === "local" || (databaseMode === "connected" && adminUnlocked);
  const productCards = shownProducts.map((product) => (
    <View style={[styles.productCard, isMobile && styles.productCardMobile]} key={product.id}>
      <Text style={styles.cardTitle}>{product.label}</Text>
      <View style={[styles.productBottle, isMobile && styles.productBottleMobile]}><WineBottle tone={product.tone} small /></View>
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
              <View style={[styles.sectionHeadingLine, isMobile && styles.sectionHeadingLineMobile]}><SectionTitle compact={isMobile}>OUR PRODUCT</SectionTitle><View style={[styles.arrows, isMobile && styles.arrowsMobile]}><Text style={[styles.arrow, isMobile && styles.arrowMobile]}>‹</Text><Text style={[styles.arrow, styles.arrowActive, isMobile && styles.arrowMobile]}>›</Text></View></View>
              {isMobile
                ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productGridMobile}>{productCards}</ScrollView>
                : <View style={styles.productGrid}>{productCards}</View>}
              {query.length > 0 && shownProducts.length === 0 && <Text style={styles.noResults}>Nenhum vinho encontrado.</Text>}
            </View>

            <View style={[styles.feature, isMobile && styles.featureMobile]}>
              <View style={[styles.featureArt, isMobile && styles.featureArtMobile]}><WineBottle small /></View>
              <View style={[styles.featureCopy, isMobile && styles.featureCopyMobile]}><Text style={[styles.featureTitle, isMobile && styles.featureTitleMobile]}>FIND YOUR PERFECT{"\n"}POUR</Text><BodyCopy>...</BodyCopy><BodyCopy>...</BodyCopy></View>
            </View>

            <View style={[styles.stats, isMobile && styles.statsMobile]}>
              {[["30+", "YEARS OF EXPERIENCE"], ["100+", "PRODUCT NEW"], ["2K+", "HAPPY CLIENT"], ["80+", "COUNTRY BRANCH"]].map(([value, label]) => (
                <View style={[styles.stat, isMobile && styles.statMobile]} key={value}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
              ))}
            </View>

            <View style={[styles.testimonials, isMobile && styles.testimonialsMobile]}>
              <View style={[styles.sectionHeadingLine, isMobile && styles.sectionHeadingLineMobile]}><SectionTitle compact={isMobile}>WHAT OUR CLIENT SAY{"\n"}OUR PRODUCT</SectionTitle><View style={[styles.arrows, isMobile && styles.arrowsMobile]}><Text style={[styles.arrow, isMobile && styles.arrowMobile]}>‹</Text><Text style={[styles.arrow, styles.arrowActive, isMobile && styles.arrowMobile]}>›</Text></View></View>
              <View style={[styles.quoteGrid, isMobile && styles.quoteGridMobile]}>
                {[0, 1].map((id) => <View style={[styles.quoteCard, isMobile && styles.quoteCardMobile]} key={id}><Text style={styles.quoteMark}>“</Text><BodyCopy style={styles.quoteCopy}>...</BodyCopy><Text style={styles.quoteName}>CLIENT - <Text style={styles.redText}>...</Text></Text><View style={styles.avatar} /></View>)}
              </View>
            </View>

            <View style={[styles.campaign, isMobile && styles.campaignMobile]}>
              <View style={styles.campaignBottles}><View style={styles.shadowBottle} /><View style={[styles.shadowBottle, styles.shadowBottleCenter]} /><View style={[styles.shadowBottle, styles.shadowBottleRight]} /></View>
              <Text style={styles.campaignYearSmall}>2023</Text>
              <Text style={styles.campaignTitle}>NEW WINE PRODUCTS</Text>
              <Text style={[styles.campaignYear, isMobile && styles.campaignYearMobile, isSmallMobile && styles.campaignYearSmallMobile]}>2023</Text>
              <View style={[styles.campaignBottle, isMobile && styles.campaignBottleMobile]}><WineBottle small /></View>
            </View>

            <View style={[styles.cta, isMobile && styles.ctaMobile]}>
              <View><Text style={styles.ctaTitle}>ADICIONE À SUA SACOLA</Text><BodyCopy style={styles.ctaCopy}>...</BodyCopy></View>
              <Pressable onPress={() => addToCart("Wine dreams")} style={styles.ctaButton}><Text style={styles.ctaButtonText}>Adicionar à Sacola</Text></Pressable>
            </View>

            <View style={[styles.footer, isMobile && styles.footerMobile]}>
              <View style={[styles.footerColumn, isMobile && styles.footerAboutMobile]}><Text style={styles.footerBrand}>Matto Chalés</Text><BodyCopy>...</BodyCopy><Text style={styles.social}>◉  ◎  ◌  ◉</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>QUICK LINK</Text><Text style={styles.footerLink}>Home</Text><Text style={styles.footerLink}>Our product</Text><Text style={styles.footerLink}>Testimonial</Text><Text style={styles.footerLink}>Contact us</Text></View>
              <View style={[styles.footerColumn, isMobile && styles.footerColumnMobile]}><Text style={styles.footerHeading}>CONTACT US</Text><Text style={styles.footerLink}>⌖  ...</Text><Text style={styles.footerLink}>☎  ...</Text><Text style={styles.footerLink}>✉  ...</Text></View>
            </View>
            <Text style={styles.copyright}>...</Text>
          </View>
        </ScrollView>

        {panel !== null && (
        <View style={panel === "settings" ? [styles.settingsScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }] : [styles.panelPosition, { bottom: Math.max(100, insets.bottom + 91) }]}>
            <View style={panel === "settings" ? styles.settingsScreenPanel : panelStyle}>
              {panel === "settings" ? (
                <View style={styles.settingsScreenHeader}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a loja" onPress={() => setPanel(null)} style={styles.settingsBackButton}><Text style={styles.settingsBackArrow}>‹</Text><Text style={styles.settingsBackText}>Loja</Text></Pressable>
                  <View style={styles.settingsScreenHeadingCopy}><Text style={styles.settingsScreenTitle}>Configurações</Text><Text style={styles.settingsScreenSubtitle}>Gerencie seus produtos e o catálogo</Text></View>
                </View>
              ) : (
                <View style={styles.panelHeading}>
                  <Text style={styles.panelTitle}>{panel === "search" ? "Buscar produtos" : "Seu carrinho"}</Text>
                  <Pressable accessibilityLabel="Fechar painel" onPress={() => setPanel(null)}><Text style={styles.panelClose}>×</Text></Pressable>
                </View>
              )}
              {panel === "search" && <><TextInput value={query} onChangeText={setQuery} placeholder="Digite um vinho..." placeholderTextColor="#9e9388" style={styles.searchInput} autoFocus /><Text style={styles.panelHint}>Sparkling, fortified ou aromatized wine</Text></>}
              {panel === "cart" && (cartCount === 0 ? <Text style={styles.panelHint}>Seu carrinho está vazio.</Text> : <View style={styles.cartList}>{Object.entries(cart).map(([name, quantity]) => <View style={styles.cartItem} key={name}><Text style={styles.cartItemName}>{name} × {quantity}</Text><Pressable onPress={() => removeFromCart(name)}><Text style={styles.removeItem}>Remover</Text></Pressable></View>)}<Pressable onPress={() => setPanel(null)} style={styles.primaryButton}><Text style={styles.buttonText}>Falar com a loja</Text></Pressable></View>)}
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
                  <Text style={styles.settingLabel}>Cor da garrafa</Text>
                  <View style={styles.toneOptions}>{[["ivory", "Clara"], ["gold", "Dourada"], ["olive", "Oliva"]].map(([tone, label]) => <Pressable key={tone} onPress={() => setProductTone(tone)} style={[styles.toneOption, productTone === tone && styles.toneOptionActive]}><Text style={styles.toneOptionText}>{label}</Text></Pressable>)}</View>
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
  scrollContent: { paddingBottom: 140 },
  page: { width: "100%", alignSelf: "stretch", backgroundColor: "#0d0b09", overflow: "hidden" },
  pageMobile: { width: "100%" },
  header: { height: 72, paddingHorizontal: 28, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#49372a", flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0d0b09" },
  headerMobile: { height: 60, paddingHorizontal: 18 },
  brand: { color: "#f3f1ef", fontSize: 27, fontWeight: "700", letterSpacing: -1 },
  brandMobile: { fontSize: 24 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandLogo: { width: 56, height: 42 },
  brandLogoMobile: { width: 44, height: 34 },
  brandAccent: { color: "#c18d5e" },
  hero: { minHeight: 480, paddingHorizontal: 34, paddingVertical: 66, backgroundColor: "#18110d", flexDirection: "row", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" },
  heroMobile: { minHeight: 0, paddingHorizontal: 18, paddingTop: 36, paddingBottom: 28, flexDirection: "column", alignItems: "stretch", justifyContent: "center" },
  heroCopy: { flex: 1.2, zIndex: 2 },
  heroCopyMobile: { flex: 0, flexBasis: "auto", flexShrink: 0 },
  heroTitle: { color: "#f5f2f0", fontSize: 57, lineHeight: 62, fontWeight: "800", letterSpacing: -2 },
  heroTitleMobile: { fontSize: 43, lineHeight: 47, letterSpacing: -1.5 },
  heroTitleSmall: { fontSize: 37, lineHeight: 41 },
  heroTagline: { color: "#d3cecb", marginTop: 16, marginBottom: 14, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  heroStaticPhotoArea: { flex: 1.05, height: 370, minWidth: 0, alignItems: "center", justifyContent: "center" },
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
  sectionHeadingLine: { flexDirection: "row", alignItems: "center", marginBottom: 25 },
  sectionHeadingLineMobile: { alignItems: "center", flexWrap: "wrap", rowGap: 10, marginBottom: 20 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  sectionRule: { width: 52, height: 1, backgroundColor: "#d8c9b8" },
  sectionRuleMobile: { width: 32 },
  sectionTitle: { color: "#f2ece5", fontSize: 24, fontWeight: "700", letterSpacing: -.5 },
  sectionTitleMobile: { fontSize: 18, lineHeight: 23, flexShrink: 1 },
  arrows: { marginLeft: "auto", flexDirection: "row", gap: 8 },
  arrowsMobile: { marginLeft: "auto", gap: 6 },
  arrow: { width: 31, height: 31, textAlign: "center", textAlignVertical: "center", overflow: "hidden", borderWidth: 1, borderColor: "#8f7965", borderRadius: 18, color: "#f2ece5", fontSize: 22 },
  arrowMobile: { width: 27, height: 27, fontSize: 19, lineHeight: 25 },
  arrowActive: { borderColor: "#805739", backgroundColor: "#805739" },
  productGrid: { flexDirection: "row", gap: 16 },
  productGridMobile: { flexDirection: "row", gap: 12, paddingRight: 18 },
  productCard: { flex: 1, minWidth: 0, alignItems: "center", padding: 15, borderWidth: 1, borderColor: "#49372a", backgroundColor: "#19130f" },
  productCardMobile: { width: 245, flex: 0, flexBasis: "auto", flexShrink: 0, padding: 14 },
  cardTitle: { minHeight: 34, color: "#f2ece5", fontSize: 14, fontWeight: "700", textAlign: "center" },
  productBottle: { height: 160, alignItems: "center", justifyContent: "center", marginTop: 2 },
  productBottleMobile: { height: 210, justifyContent: "flex-end" },
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
  toneOptions: { flexDirection: "row", gap: 8 },
  toneOption: { paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: "#61482f", borderRadius: 7 },
  toneOptionActive: { backgroundColor: "#765036", borderColor: "#d5a472" },
  toneOptionText: { color: "#eee5da", fontSize: 10 },
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
