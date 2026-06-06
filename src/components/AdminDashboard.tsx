import React, { useState, useEffect, useCallback } from 'react';
import { Users, Tag, Award, Search, Plus, TrendingUp, CreditCard, Activity, ArrowRight, Menu, X, UserPlus, Loader2, Pencil, ToggleLeft, ToggleRight, Eye, EyeOff, ClipboardList, CheckCircle, Clock, XCircle, Trash2, ShoppingBag, Banknote, PackagePlus, BadgeCheck, Percent } from 'lucide-react';
import { TierConfig, User, StaffRole, PromotionRedemptionRequest, CompanySettings } from '../types';
import { api } from '../api';
import { formatBirthdayDisplay, normalizeBirthdayInput } from '../utils';
import { getCurrentCompany } from '../lib/company';
import { getTierBahtPerPoint, normalizeTierBenefits, getTierDiscountPercent, getTierDurationDays } from '../lib/tiers';

interface AdminDashboardProps {
  tiers: TierConfig[];
  setTiers: React.Dispatch<React.SetStateAction<TierConfig[]>>;
  role: StaffRole;
}

interface MemberForm {
  lineId: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  tier: string;
  points: string;
  totalSpent: string;
}

const EMPTY_FORM: MemberForm = { lineId: '', name: '', phone: '', email: '', birthday: '', tier: 'Standard', points: '0', totalSpent: '0' };

type ModalMode = 'add' | 'edit';

const ROLE_TABS: Record<StaffRole, Array<'overview' | 'users' | 'orders' | 'products' | 'promotions' | 'levels' | 'staff'>> = {
  admin: ['overview', 'users', 'orders', 'products', 'promotions', 'levels', 'staff'],
  manager: ['overview', 'users', 'orders', 'products', 'promotions'],
  user: ['overview', 'users', 'orders', 'products', 'promotions'],
};

export default function AdminDashboard({ tiers, setTiers, role }: AdminDashboardProps) {
  const company = getCurrentCompany();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'orders' | 'products' | 'promotions' | 'levels' | 'staff'>('overview');
  const [editingTiers, setEditingTiers] = useState(tiers);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({ pointExpiryDays: 365 });
  const [companySettingsLoading, setCompanySettingsLoading] = useState(false);
  const [companySettingsSaving, setCompanySettingsSaving] = useState(false);
  const [companySettingsError, setCompanySettingsError] = useState('');

  const visibleTabs = ROLE_TABS[role];
  const canEdit = role !== 'user';
  const canManageTiers = role === 'admin';

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Confirm inactive modal
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Products state
  const [products, setProducts]           = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct]     = useState<any | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '0', category: '' });
  const [productFormError, setProductFormError]   = useState('');
  const [productFormLoading, setProductFormLoading] = useState(false);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<any | null>(null);

  // Orders CRUD state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder]     = useState<any | null>(null);
  const [orderFilterStatus, setOrderFilterStatus] = useState('');
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<any | null>(null);
  type OrderItem = { productId: string; name: string; unitPrice: string; qty: string };
  type OrderForm = {
    userId: string;
    discount: string;
    note: string;
    status: string;
    items: OrderItem[];
  };
  const [orderForm, setOrderForm] = useState<OrderForm>({
    userId: '',
    discount: '0',
    note: '',
    status: 'pending',
    items: [{ productId: '', name: '', unitPrice: '0', qty: '1' }],
  });
  const [orderDiscountMode, setOrderDiscountMode] = useState<'manual' | 'member'>('manual');
  const [orderFormError, setOrderFormError]   = useState('');
  const [orderFormLoading, setOrderFormLoading] = useState(false);

  // Tiers (DB)
  const [tiersDb, setTiersDb] = useState<any[]>([]);
  const [tiersDbLoading, setTiersDbLoading] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<any | null>(null);
  const [tierForm, setTierForm] = useState({ name: '', minPoints: '0', multiplier: '1', discountPercent: '0', durationDays: '365', color: '#b9b99d', benefits: [''], bahtPerPoint: '10' });
  const [tierFormError, setTierFormError] = useState('');
  const [tierFormLoading, setTierFormLoading] = useState(false);
  const [confirmDeleteTier, setConfirmDeleteTier] = useState<any | null>(null);
  const [deleteTierLoading, setDeleteTierLoading] = useState(false);

  // Promotions state
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRedemptionRequest[]>([]);
  const [promotionRequestsLoading, setPromotionRequestsLoading] = useState(false);
  const [promotionRequestsError, setPromotionRequestsError] = useState('');
  const [promotionRequestActionId, setPromotionRequestActionId] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any | null>(null);
  const [promoForm, setPromoForm] = useState({ title: '', description: '', pointsRequired: '0', status: 'active', redeemMode: 'auto', expiresAt: '' });
  const [promoFormError, setPromoFormError] = useState('');
  const [promoFormLoading, setPromoFormLoading] = useState(false);
  const [confirmDeletePromo, setConfirmDeletePromo] = useState<any | null>(null);
  const [deletePromoLoading, setDeletePromoLoading] = useState(false);

  // Staff accounts
  const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [staffForm, setStaffForm] = useState({ username: '', displayName: '', password: '', role: 'user', isActive: true });
  const [staffFormError, setStaffFormError] = useState('');
  const [staffFormLoading, setStaffFormLoading] = useState(false);
  const [confirmDeactivateStaff, setConfirmDeactivateStaff] = useState<any | null>(null);

  // Dashboard stats
  const [stats, setStats] = useState<any>(null);

  const loadUsers = useCallback(async (q?: string, all?: boolean) => {
    setUsersLoading(true);
    try {
      const data = await api.getUsers(q, all ?? showInactive);
      setUsers(data.map((u: any) => ({
        id: u.id,
        lineId: u.line_id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        birthday: u.birthday,
        tierExpiresAt: u.tier_expires_at,
        avatar: u.avatar || `https://i.pravatar.cc/150?u=${u.id}`,
        tier: u.tier,
        points: u.points,
        joinedAt: u.joined_at,
        totalSpent: parseFloat(u.total_spent),
        isActive: !!u.is_active,
      })));
    } catch { /* silent */ } finally {
      setUsersLoading(false);
    }
  }, [showInactive]);

  const loadOrders = useCallback(async (status = orderFilterStatus) => {
    setOrdersLoading(true);
    try { setOrders(await api.getOrders(200, status || undefined)); } catch { /* silent */ } finally { setOrdersLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderFilterStatus]);

  const loadProducts = useCallback(async (q?: string, all?: boolean) => {
    setProductsLoading(true);
    try { setProducts(await api.getProducts(q, all ?? showAllProducts)); } catch { /* silent */ } finally { setProductsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllProducts]);

  const loadDashboard = useCallback(async () => {
    try { setStats(await api.getDashboard()); } catch { /* silent */ }
  }, []);

  const loadCompanySettings = useCallback(async () => {
    setCompanySettingsLoading(true);
    setCompanySettingsError('');
    try {
      const data: any = await api.getSettings();
      setCompanySettings({
        companyId: data.companyId || data.company_id,
        pointExpiryDays: Number(data.pointExpiryDays ?? data.point_expiry_days) > 0
          ? Number(data.pointExpiryDays ?? data.point_expiry_days)
          : 365,
        updatedAt: data.updatedAt || data.updated_at || null,
      });
    } catch { /* silent */ }
    finally { setCompanySettingsLoading(false); }
  }, []);

  const saveCompanySettings = async () => {
    setCompanySettingsSaving(true);
    setCompanySettingsError('');
    try {
      const payload = {
        pointExpiryDays: Number(companySettings.pointExpiryDays) > 0 ? parseInt(String(companySettings.pointExpiryDays), 10) : 365,
      };
      const data: any = await api.updateSettings(payload);
      setCompanySettings({
        companyId: data.companyId || data.company_id,
        pointExpiryDays: Number(data.pointExpiryDays ?? data.point_expiry_days) > 0
          ? Number(data.pointExpiryDays ?? data.point_expiry_days)
          : payload.pointExpiryDays,
        updatedAt: data.updatedAt || data.updated_at || null,
      });
    } catch (err: any) {
      setCompanySettingsError(err?.message || 'ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setCompanySettingsSaving(false);
    }
  };

  const loadTiersFromDb = useCallback(async () => {
    setTiersDbLoading(true);
    try {
      const data = await api.getTiers();
      setTiersDb(data);
      // sync กลับไปที่ App.tsx เพื่อให้ LineMockup อัปเดตด้วย
      setTiers(data.map((t: any) => ({
        id: t.id,
        name: t.name,
        minPoints: Number(t.min_points) || 0,
        bahtPerPoint: getTierBahtPerPoint(t),
        discountPercent: getTierDiscountPercent(t),
        durationDays: getTierDurationDays(t),
        multiplier: Number(t.multiplier) || 1,
        color: t.color,
        benefits: normalizeTierBenefits(t.benefits),
      })));
    } catch { /* silent */ } finally { setTiersDbLoading(false); }
  }, [setTiers]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || 'overview');
    }
  }, [activeTab, visibleTabs]);

  const openAddTier = () => {
    setEditingTier(null);
    setTierForm({ name: '', minPoints: '0', multiplier: '1', discountPercent: '0', durationDays: '365', color: '#b9b99d', benefits: [''], bahtPerPoint: '10' });
    setTierFormError('');
    setShowTierModal(true);
  };

  const openEditTier = (t: any) => {
    setEditingTier(t);
    const bens = normalizeTierBenefits(t.benefits);
    setTierForm({
      name: t.name, minPoints: String(t.min_points), multiplier: String(t.multiplier),
      discountPercent: String(getTierDiscountPercent(t)),
      durationDays: String(getTierDurationDays(t)),
      color: t.color, benefits: bens.length ? bens : [''],
      bahtPerPoint: String(getTierBahtPerPoint(t)),
    });
    setTierFormError('');
    setShowTierModal(true);
  };

  const handleTierFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.name.trim()) { setTierFormError('กรุณากรอกชื่อระดับ'); return; }
    setTierFormLoading(true); setTierFormError('');
    try {
      const payload = {
        name:         tierForm.name.trim(),
        minPoints:    parseInt(tierForm.minPoints)    || 0,
        multiplier:   parseFloat(tierForm.multiplier) || 1,
        color:        tierForm.color,
        benefits:     normalizeTierBenefits(tierForm.benefits),
        bahtPerPoint: parseFloat(tierForm.bahtPerPoint) || 10,
        discountPercent: parseFloat(tierForm.discountPercent) || 0,
        durationDays: parseInt(tierForm.durationDays) || 365,
      };
      if (editingTier) await api.updateTier(editingTier.id, payload);
      else             await api.createTier(payload);
      setShowTierModal(false);
      await loadTiersFromDb();
    } catch (err: any) { setTierFormError(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setTierFormLoading(false); }
  };

  const handleDeleteTier = async () => {
    if (!confirmDeleteTier) return;
    setDeleteTierLoading(true);
    try {
      await api.deleteTier(confirmDeleteTier.id);
      setConfirmDeleteTier(null);
      await loadTiersFromDb();
    } catch (err: any) { setTierFormError(err.message || ''); }
    finally { setDeleteTierLoading(false); }
  };

  const loadPromotions = useCallback(async () => {
    setPromosLoading(true);
    try {
      const promoData = await api.getPromotions();
      setPromotions(promoData);

      if (canEdit) {
        try {
          setPromotionRequestsLoading(true);
          setPromotionRequestsError('');
          setPromotionRequests(await api.getPromotionRequests('pending'));
        } catch (err: any) {
          setPromotionRequests([]);
          setPromotionRequestsError(err?.message || 'ไม่สามารถโหลดคำขอแลกแต้มได้');
        } finally {
          setPromotionRequestsLoading(false);
        }
      } else {
        setPromotionRequests([]);
        setPromotionRequestsError('');
      }
    } catch { /* silent */ } finally { setPromosLoading(false); }
  }, [canEdit]);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try { setStaffAccounts(await api.getStaff()); } catch { /* silent */ } finally { setStaffLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'users')       loadUsers();
    if (activeTab === 'orders')      { loadOrders(); loadTiersFromDb(); }
    if (activeTab === 'products')    loadProducts();
    if (activeTab === 'promotions')  loadPromotions();
    if (activeTab === 'levels')      { loadTiersFromDb(); loadCompanySettings(); }
    if (activeTab === 'staff')       loadStaff();
    if (activeTab === 'overview')    { loadDashboard(); loadTiersFromDb(); loadCompanySettings(); }
  }, [activeTab, loadUsers, loadOrders, loadProducts, loadPromotions, loadTiersFromDb, loadDashboard, loadStaff, loadCompanySettings]);

  useEffect(() => {
    if (activeTab !== 'products') return;
    const t = setTimeout(() => loadProducts(productSearch || undefined), 300);
    return () => clearTimeout(t);
  }, [productSearch, activeTab, loadProducts]);

  // ─── Product handlers ───
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: '0', category: '' });
    setProductFormError('');
    setShowProductModal(true);
  };
  const openEditProduct = (p: any) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, description: p.description || '', price: String(p.price), category: p.category || '' });
    setProductFormError('');
    setShowProductModal(true);
  };
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) { setProductFormError('กรุณากรอกชื่อสินค้า'); return; }
    setProductFormLoading(true); setProductFormError('');
    try {
      const payload = { name: productForm.name.trim(), description: productForm.description || undefined, price: parseFloat(productForm.price) || 0, category: productForm.category || undefined };
      if (editingProduct) await api.updateProduct(editingProduct.id, payload);
      else                await api.createProduct(payload);
      setShowProductModal(false);
      await loadProducts();
    } catch (err: any) { setProductFormError(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setProductFormLoading(false); }
  };
  const handleDeleteProduct = async (p: any) => {
    await api.deleteProduct(p.id);
    setConfirmDeleteProduct(null);
    await loadProducts();
  };

  // ─── Order handlers ───
  const getOrderMemberDiscountPercent = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    if (!selectedUser) return 0;
    const selectedTier = tiersDb.find((t: any) => t.name === selectedUser.tier);
    return getTierDiscountPercent(selectedTier || {});
  };

  const getOrderMemberDiscountAmount = (userId: string, items: OrderItem[] = orderForm.items) => {
    const discountPercent = getOrderMemberDiscountPercent(userId);
    if (discountPercent <= 0) return 0;
    const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.unitPrice) || 0) * (parseInt(it.qty) || 1), 0);
    return Math.min((subtotal * discountPercent) / 100, subtotal);
  };

  const openAddOrder = async () => {
    setEditingOrder(null);
    setOrderForm({
      userId: '',
      discount: '0',
      note: '',
      status: 'pending',
      items: [{ productId: '', name: '', unitPrice: '0', qty: '1' }],
    });
    setOrderDiscountMode('manual');
    setOrderFormError('');
    if (!products.length) await loadProducts('', true);
    setShowOrderModal(true);
  };
  const openEditOrder = async (o: any) => {
    setEditingOrder(o);
    const items = (o.items || []).map((it: any) => ({
      productId: it.product_id || '', name: it.name, unitPrice: String(it.unit_price), qty: String(it.qty)
    }));
    setOrderForm({
      userId: o.user_id || '',
      discount: String(o.discount ?? 0),
      note: o.note || '',
      status: o.status,
      items: items.length ? items : [{ productId: '', name: '', unitPrice: '0', qty: '1' }],
    });
    setOrderDiscountMode(o.discount_mode === 'member' ? 'member' : 'manual');
    setOrderFormError('');
    if (!products.length) await loadProducts('', true);
    setShowOrderModal(true);
  };
  const applyMemberDiscountForOrder = (userId: string, nextItems: OrderItem[] = orderForm.items) => {
    const discountPercent = getOrderMemberDiscountPercent(userId);
    if (discountPercent <= 0) {
      setOrderDiscountMode('manual');
      setOrderForm(p => ({ ...p, userId, discount: '0' }));
      return;
    }

    const discountAmount = getOrderMemberDiscountAmount(userId, nextItems);
    setOrderDiscountMode('member');
    setOrderForm(p => ({ ...p, userId, discount: discountAmount.toFixed(2) }));
  };
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.userId) { setOrderFormError('กรุณาเลือกลูกค้า'); return; }
    const validItems = orderForm.items.filter(it => it.name.trim());
    if (!validItems.length) { setOrderFormError('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setOrderFormLoading(true); setOrderFormError('');
    try {
      const payload = {
        userId: orderForm.userId,
        discount: orderDiscount,
        discountMode: orderDiscountMode,
        note: orderForm.note || undefined,
        status: orderForm.status,
        items: validItems.map(it => ({ productId: it.productId || undefined, name: it.name, unitPrice: parseFloat(it.unitPrice) || 0, qty: parseInt(it.qty) || 1 })),
      };
      if (editingOrder) await api.updateOrder(editingOrder.id, payload);
      else              await api.createOrder(payload);
      setShowOrderModal(false);
      await refreshOrderViews();
    } catch (err: any) { setOrderFormError(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setOrderFormLoading(false); }
  };
  const addOrderItem = () => setOrderForm(p => {
    const nextItems = [...p.items, { productId: '', name: '', unitPrice: '0', qty: '1' }];
    return {
      ...p,
      items: nextItems,
      ...(orderDiscountMode === 'member' && p.userId ? { discount: getOrderMemberDiscountAmount(p.userId, nextItems).toFixed(2) } : {}),
    };
  });
  const removeOrderItem = (i: number) => setOrderForm(p => {
    const nextItems = p.items.filter((_, j) => j !== i);
    return {
      ...p,
      items: nextItems,
      ...(orderDiscountMode === 'member' && p.userId ? { discount: getOrderMemberDiscountAmount(p.userId, nextItems).toFixed(2) } : {}),
    };
  });
  const setOrderItem = (i: number, field: string, val: string) =>
    setOrderForm(p => {
      const nextItems = p.items.map((it, j) => j === i ? { ...it, [field]: val } : it);
      return {
        ...p,
        items: nextItems,
        ...(orderDiscountMode === 'member' && p.userId ? { discount: getOrderMemberDiscountAmount(p.userId, nextItems).toFixed(2) } : {}),
      };
    });
  const pickProduct = (i: number, pid: string) => {
    const prod = products.find(p => p.id === pid);
    if (prod) setOrderForm(p => {
      const nextItems = p.items.map((it, j) => j === i ? { ...it, productId: pid, name: prod.name, unitPrice: String(prod.price) } : it);
      return {
        ...p,
        items: nextItems,
        ...(orderDiscountMode === 'member' && p.userId ? { discount: getOrderMemberDiscountAmount(p.userId, nextItems).toFixed(2) } : {}),
      };
    });
    else setOrderItem(i, 'productId', pid);
  };
  const orderSubtotal = orderForm.items.reduce((s, it) => s + (parseFloat(it.unitPrice) || 0) * (parseInt(it.qty) || 1), 0);
  const orderDiscount = Math.min(Math.max(Number(orderForm.discount) || 0, 0), orderSubtotal);
  const orderNetTotal = Math.max(orderSubtotal - orderDiscount, 0);
  const selectedOrderUser = users.find(u => u.id === orderForm.userId) || null;
  const selectedOrderTier = selectedOrderUser ? tiersDb.find((t: any) => t.name === selectedOrderUser.tier) || null : null;
  const selectedOrderTierDiscountPercent = selectedOrderTier ? getTierDiscountPercent(selectedOrderTier) : 0;
  const selectedOrderTierDiscountAmount = selectedOrderTierDiscountPercent > 0
    ? Math.min((orderSubtotal * selectedOrderTierDiscountPercent) / 100, orderSubtotal)
    : 0;
  const getOrderDiscountModeLabel = (o: any) => {
    const discount = Number(o.discount || 0);
    const mode = String(o.discount_mode || '').toLowerCase();
    if (discount <= 0) return 'ไม่มีส่วนลด';
    if (mode === 'member') return 'ส่วนลดสมาชิก';
    return 'ส่วนลดเอง';
  };
  const getOrderDiscountModeBadgeClass = (o: any) => {
    const discount = Number(o.discount || 0);
    const mode = String(o.discount_mode || '').toLowerCase();
    if (discount <= 0) return 'bg-japandi-100 text-japandi-500 border-japandi-200';
    return mode === 'member'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  };
  useEffect(() => {
    if (!showOrderModal) return;
    if (orderDiscountMode !== 'member') return;
    if (!orderForm.userId || selectedOrderTierDiscountPercent <= 0) return;

    const nextDiscount = selectedOrderTierDiscountAmount.toFixed(2);
    setOrderForm(prev => {
      if (prev.userId !== orderForm.userId) return prev;
      if (String(Number(prev.discount || 0).toFixed(2)) === nextDiscount) return prev;
      return { ...prev, discount: nextDiscount };
    });
  }, [
    showOrderModal,
    orderDiscountMode,
    orderForm.userId,
    orderSubtotal,
    selectedOrderTierDiscountPercent,
    selectedOrderTierDiscountAmount,
  ]);
  const getOrderPoints = (o: any) => {
    const storedPoints = Number(o.points_earned ?? o.pointsEarned);
    if (Number.isFinite(storedPoints) && storedPoints > 0) return storedPoints;

    const orderTier = o.user_tier || o.tier;
    const tier = tiersDb.find((t: any) => t.name === orderTier);
    const bahtPerPoint = getTierBahtPerPoint(tier || {});
    const multiplier = Number(tier?.multiplier ?? 1) || 1;
    const amount = Number(o.amount) || 0;

    return amount > 0 ? Math.floor((amount / bahtPerPoint) * multiplier) : 0;
  };
  const refreshOrderViews = async () => {
    await Promise.all([
      loadOrders(),
      loadDashboard(),
      loadUsers(search || undefined, showInactive),
    ]);
  };

  // ─── Promo handlers ───
  const openAddPromo = () => {
    setEditingPromo(null);
    setPromoForm({ title: '', description: '', pointsRequired: '0', status: 'active', redeemMode: 'auto', expiresAt: '' });
    setPromoFormError('');
    setShowPromoModal(true);
  };

  const openEditPromo = (p: any) => {
    setEditingPromo(p);
    setPromoForm({
      title:          p.title,
      description:    p.description || '',
      pointsRequired: String(p.points_required),
      status:         p.status,
      redeemMode:     p.redeem_mode || p.redeemMode || 'auto',
      expiresAt:      p.expires_at ? p.expires_at.slice(0, 10) : '',
    });
    setPromoFormError('');
    setShowPromoModal(true);
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.title.trim()) { setPromoFormError('กรุณากรอกชื่อโปรโมชั่น'); return; }
    setPromoFormLoading(true);
    setPromoFormError('');
    try {
      const payload = {
        title:          promoForm.title.trim(),
        description:    promoForm.description.trim() || null,
        pointsRequired: parseInt(promoForm.pointsRequired) || 0,
        status:         promoForm.status,
        redeemMode:     promoForm.redeemMode,
        expiresAt:      promoForm.expiresAt || null,
      };
      if (editingPromo) await api.updatePromotion(editingPromo.id, payload);
      else              await api.createPromotion(payload);
      setShowPromoModal(false);
      await loadPromotions();
    } catch (err: any) {
      setPromoFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setPromoFormLoading(false);
    }
  };

  const handleDeletePromo = async () => {
    if (!confirmDeletePromo) return;
    setDeletePromoLoading(true);
    try {
      await api.deletePromotion(confirmDeletePromo.id);
      setConfirmDeletePromo(null);
      await loadPromotions();
    } catch { /* silent */ } finally { setDeletePromoLoading(false); }
  };

  const handleTogglePromoStatus = async (p: any) => {
    await api.updatePromotion(p.id, {
      title:          p.title,
      description:    p.description,
      pointsRequired: p.points_required,
      status:         p.status === 'active' ? 'inactive' : 'active',
      redeemMode:     p.redeem_mode || p.redeemMode || 'auto',
      expiresAt:      p.expires_at || p.expiresAt || undefined,
    });
    await loadPromotions();
  };

  const handleApprovePromotionRequest = async (request: PromotionRedemptionRequest) => {
    setPromotionRequestActionId(request.id);
    setPromotionRequestsError('');
    try {
      await api.approvePromotionRequest(request.id);
      await loadPromotions();
    } catch (err: any) {
      setPromotionRequestsError(err?.message || 'ไม่สามารถอนุมัติคำขอได้');
    } finally {
      setPromotionRequestActionId(null);
    }
  };

  const handleRejectPromotionRequest = async (request: PromotionRedemptionRequest) => {
    setPromotionRequestActionId(request.id);
    setPromotionRequestsError('');
    try {
      await api.rejectPromotionRequest(request.id);
      await loadPromotions();
    } catch (err: any) {
      setPromotionRequestsError(err?.message || 'ไม่สามารถปฏิเสธคำขอได้');
    } finally {
      setPromotionRequestActionId(null);
    }
  };

  // ─── Staff handlers ───
  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ username: '', displayName: '', password: '', role: 'user', isActive: true });
    setStaffFormError('');
    setShowStaffModal(true);
  };

  const openEditStaff = (staff: any) => {
    setEditingStaff(staff);
    setStaffForm({
      username: staff.username,
      displayName: staff.displayName,
      password: '',
      role: staff.role,
      isActive: !!staff.isActive,
    });
    setStaffFormError('');
    setShowStaffModal(true);
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.username.trim()) { setStaffFormError('กรุณากรอกชื่อผู้ใช้'); return; }
    if (!staffForm.displayName.trim()) { setStaffFormError('กรุณากรอกชื่อที่แสดง'); return; }
    if (!editingStaff && !staffForm.password.trim()) { setStaffFormError('กรุณากรอกรหัสผ่าน'); return; }

    setStaffFormLoading(true);
    setStaffFormError('');
    try {
      const nextPassword = staffForm.password.trim();
      const payload = {
        username: staffForm.username.trim(),
        displayName: staffForm.displayName.trim(),
        role: staffForm.role,
        isActive: staffForm.isActive,
        ...(nextPassword ? { password: nextPassword } : {}),
      };

      if (editingStaff) {
        await api.updateStaff(editingStaff.id, payload);
      } else {
        await api.createStaff({ username: payload.username, displayName: payload.displayName, password: nextPassword, role: payload.role });
      }
      setShowStaffModal(false);
      await loadStaff();
    } catch (err: any) {
      setStaffFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setStaffFormLoading(false);
    }
  };

  const handleToggleStaffActive = async (staff: any) => {
    await api.updateStaff(staff.id, { isActive: !staff.isActive });
    await loadStaff();
  };

  useEffect(() => {
    if (activeTab !== 'users') return;
    const t = setTimeout(() => loadUsers(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search, activeTab, loadUsers]);

  // ─── handlers ───
  const handleSaveTiers = () => { setTiers(editingTiers); alert('บันทึกการตั้งค่าเรียบร้อยแล้ว'); };

  const handleTierChange = (id: string, field: 'minPoints' | 'multiplier' | 'color', value: string) =>
    setEditingTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: field === 'color' ? value : Number(value) } : t));

  const openAddModal = () => {
    setModalMode('add');
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setEditingUser(user);
    setForm({
      lineId:     user.lineId,
      name:       user.name,
      phone:      user.phone       || '',
      email:      user.email       || '',
      birthday:   formatBirthdayDisplay(user.birthday),
      tier:       user.tier,
      points:     String(user.points),
      totalSpent: String(user.totalSpent),
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setFormError(''); };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!form.lineId.trim()) { setFormError('กรุณากรอก Line ID'); return; }

    const birthday = form.birthday.trim()
      ? normalizeBirthdayInput(form.birthday.trim())
      : null;
    if (form.birthday.trim() && !birthday) {
      setFormError('กรุณากรอกวันเกิดเป็น dd/MM/yyyy');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      if (modalMode === 'add') {
        await api.createUser({
          lineId: form.lineId.trim(),
          name: form.name.trim(),
          phone: form.phone || undefined,
          email: form.email || undefined,
          birthday: birthday || undefined,
        });
      } else if (editingUser) {
        await api.updateUser(editingUser.id, {
          lineId:     form.lineId.trim(),
          name:       form.name.trim(),
          phone:      form.phone      || undefined,
          email:      form.email      || undefined,
          birthday:   birthday        || undefined,
          tier:       form.tier,
          points:     parseInt(form.points)       || 0,
          totalSpent: parseFloat(form.totalSpent) || 0,
        });
      }
      closeModal();
      await loadUsers(search || undefined);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.isActive) {
      setConfirmUser(user);    // แสดง confirm dialog ก่อน inactive
    } else {
      // activate กลับทันที ไม่ต้อง confirm
      setStatusLoading(true);
      try {
        await api.setUserStatus(user.id, true);
        await loadUsers(search || undefined);
      } catch { /* silent */ } finally {
        setStatusLoading(false);
      }
    }
  };

  const confirmInactive = async () => {
    if (!confirmUser) return;
    setStatusLoading(true);
    try {
      await api.setUserStatus(confirmUser.id, false);
      setConfirmUser(null);
      await loadUsers(search || undefined);
    } catch { /* silent */ } finally {
      setStatusLoading(false);
    }
  };

  const totalUsers   = stats?.totalUsers  ?? users.length;
  const activePromos = stats?.activePromos ?? promotions.filter(p => p.status === 'active').length;
  const totalPoints  = stats?.totalPoints  ?? users.reduce((s, u) => s + u.points, 0);
  const recentOrders = stats?.recentOrders ?? orders.slice(0, 4);
  const quickActions: Array<{
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    sub: string;
    action: () => void;
  }> = [
    ...(canEdit ? [{ icon: UserPlus, title: 'เพิ่มสมาชิกใหม่', sub: 'บันทึกข้อมูลลูกค้า', action: () => { setActiveTab('users'); setTimeout(openAddModal, 100); } }] : []),
    ...(canEdit ? [{ icon: Tag, title: 'สร้างโปรโมชั่นใหม่', sub: 'ดึงดูดลูกค้าด้วยคูปอง', action: () => setActiveTab('promotions') }] : []),
    { icon: Users, title: 'ดูรายชื่อลูกค้า', sub: 'ตรวจสอบประวัติสมาชิก', action: () => setActiveTab('users') },
    ...(canManageTiers ? [{ icon: Award, title: 'ปรับเกณฑ์ระดับสถานะ', sub: 'แก้ไขคะแนนเลื่อนขั้น', action: () => setActiveTab('levels') }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 h-[calc(100vh-64px)] md:h-full text-japandi-900 relative">

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white/80 backdrop-blur-xl border border-japandi-200 rounded-2xl p-4 shrink-0 z-20 shadow-sm">
        <div className="text-sm font-bold text-japandi-900 uppercase tracking-wider">CRM System</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1 rounded-lg bg-japandi-100 text-japandi-800">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black/20 z-20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <div className={`${isMobileMenuOpen ? 'flex absolute top-[76px] left-4 right-4' : 'hidden'} md:flex md:relative md:w-64 bg-white/80 backdrop-blur-xl border border-japandi-200 rounded-2xl md:rounded-3xl p-4 md:p-5 shrink-0 flex-col z-30 shadow-lg md:shadow-sm overflow-y-auto max-h-[70vh] md:max-h-none`}>
        <div className="text-xs font-bold text-japandi-500 uppercase tracking-wider mb-2 md:mb-6 px-3 hidden md:block">CRM System</div>
        <nav className="flex flex-col gap-2 w-full">
          {([
            { key: 'overview',   icon: Activity,      label: 'Dashboard' },
            { key: 'users',      icon: Users,         label: 'ลูกค้า & สมาชิก' },
            { key: 'orders',     icon: ClipboardList, label: 'รายการสั่งซื้อ' },
            { key: 'products',   icon: ShoppingBag,   label: 'สินค้า' },
            { key: 'promotions', icon: Tag,           label: 'จัดการโปรโมชั่น' },
            { key: 'levels',     icon: Award,         label: 'ตั้งค่า Loyalty Level' },
            { key: 'staff',      icon: BadgeCheck,    label: 'บัญชีผู้ใช้' },
          ] as const).filter(({ key }) => visibleTabs.includes(key)).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => { setActiveTab(key); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 md:gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === key ? 'bg-japandi-800 text-white shadow-md' : 'text-japandi-600 hover:bg-japandi-100'}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white/80 backdrop-blur-xl border border-japandi-200 rounded-2xl md:rounded-3xl overflow-hidden flex flex-col z-10 shadow-sm min-h-0">
        {/* Header */}
        <div className="px-4 py-4 md:px-6 md:py-5 border-b border-japandi-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-japandi-50/50">
          <h1 className="text-xl font-bold text-japandi-900">
            {activeTab === 'overview'   && 'ภาพรวมระบบ (Dashboard)'}
            {activeTab === 'users'      && 'รายชื่อลูกค้า (Customers)'}
            {activeTab === 'orders'     && 'รายการสั่งซื้อ (Orders)'}
            {activeTab === 'products'   && 'สินค้า (Products)'}
            {activeTab === 'promotions' && 'จัดการโปรโมชั่น (Promotions)'}
            {activeTab === 'levels'     && 'ตั้งค่าระดับสมาชิก (Loyalty Tiers)'}
            {activeTab === 'staff'      && 'บัญชีผู้ใช้ (Staff Accounts)'}
          </h1>
          <div className="flex w-full sm:w-auto gap-2 flex-wrap">
            {activeTab === 'users' && (<>
              <div className="relative flex-1 sm:w-56">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-japandi-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหา Line ID / ชื่อ..."
                  className="pl-9 pr-4 py-2 bg-white border border-japandi-300 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>
              {/* Toggle show inactive */}
              <button onClick={() => { setShowInactive(v => !v); loadUsers(search || undefined, !showInactive); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${showInactive ? 'bg-japandi-200 border-japandi-400 text-japandi-800' : 'bg-white border-japandi-200 text-japandi-500 hover:border-japandi-400'}`}
                title={showInactive ? 'ซ่อนสมาชิกที่ inactive' : 'แสดงสมาชิกที่ inactive ด้วย'}>
                {showInactive ? <Eye size={14} /> : <EyeOff size={14} />}
                {showInactive ? 'ทั้งหมด' : 'Active'}
              </button>
              {canEdit && (
                <button onClick={openAddModal}
                  className="flex items-center gap-1.5 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 transition-colors shadow-md whitespace-nowrap">
                  <UserPlus size={15} /> เพิ่มสมาชิก
                </button>
              )}
            </>)}
            {activeTab === 'orders' && (
              <div className="flex gap-2 flex-wrap">
                {/* filter status */}
                {(['','pending','paid','cancel'] as const).map(s => (
                  <button key={s} onClick={() => { setOrderFilterStatus(s); loadOrders(s); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${orderFilterStatus === s
                      ? 'bg-japandi-800 text-white border-japandi-800'
                      : 'bg-white border-japandi-200 text-japandi-600 hover:border-japandi-400'}`}>
                    {s === '' ? 'ทั้งหมด' : s === 'pending' ? 'รอชำระ' : s === 'paid' ? 'ชำระแล้ว' : 'ยกเลิก'}
                  </button>
                ))}
                {canEdit && (
                  <button onClick={openAddOrder} className="flex items-center gap-1.5 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 shadow-md whitespace-nowrap">
                    <Plus size={15} /> สร้างออเดอร์
                  </button>
                )}
              </div>
            )}
            {activeTab === 'products' && (
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-japandi-400" />
                  <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ค้นหาสินค้า..."
                    className="pl-8 pr-3 py-2 bg-white border border-japandi-300 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
                </div>
                <button onClick={() => { setShowAllProducts(v => !v); loadProducts(productSearch || undefined, !showAllProducts); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${showAllProducts ? 'bg-japandi-200 border-japandi-400 text-japandi-800' : 'bg-white border-japandi-200 text-japandi-500 hover:border-japandi-400'}`}>
                  {showAllProducts ? <Eye size={13}/> : <EyeOff size={13}/>}
                  {showAllProducts ? 'ทั้งหมด' : 'Active'}
                </button>
                {canEdit && (
                  <button onClick={openAddProduct} className="flex items-center gap-1.5 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 shadow-md whitespace-nowrap">
                    <PackagePlus size={15} /> เพิ่มสินค้า
                  </button>
                )}
              </div>
            )}
            {activeTab === 'promotions' && canEdit && (
              <button onClick={openAddPromo} className="flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 shadow-md">
                <Plus size={16} /><span className="whitespace-nowrap">สร้างโปรโมชั่นใหม่</span>
              </button>
            )}
            {activeTab === 'levels' && canManageTiers && (
              <button onClick={openAddTier} className="flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 shadow-md">
                <Plus size={16} /><span className="whitespace-nowrap">เพิ่มระดับใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 bg-japandi-50/30">

          {/* ─── OVERVIEW ─── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                  <div className="w-12 h-12 bg-japandi-100 text-japandi-800 rounded-xl flex items-center justify-center mb-4"><Users size={24} /></div>
                  <p className="text-xs text-japandi-500 font-bold uppercase tracking-wider mb-1">จำนวนลูกค้าทั้งหมด</p>
                  <p className="text-3xl font-bold">{Number(totalUsers).toLocaleString()} <span className="text-sm font-normal text-japandi-500">คน</span></p>
                </div>
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                  <div className="w-12 h-12 bg-[#ffe8d6] text-japandi-600 rounded-xl flex items-center justify-center mb-4"><Tag size={24} /></div>
                  <p className="text-xs text-japandi-500 font-bold uppercase tracking-wider mb-1">โปรโมชั่นที่ใช้งานอยู่</p>
                  <p className="text-3xl font-bold">{activePromos} <span className="text-sm font-normal text-japandi-500">แคมเปญ</span></p>
                </div>
                <div className="bg-japandi-800 border border-japandi-900 rounded-2xl p-5 shadow-sm text-white relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  <div className="w-12 h-12 bg-white/10 text-japandi-200 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={24} /></div>
                  <p className="text-xs text-japandi-300 font-bold uppercase tracking-wider mb-1">คะแนนสะสมรวม</p>
                  <p className="text-3xl font-bold">{Number(totalPoints).toLocaleString()} <span className="text-sm font-normal text-japandi-300">pts</span></p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">รายการสั่งซื้อล่าสุด</h3>
                    <button onClick={() => setActiveTab('orders')} className="text-xs font-semibold text-japandi-600 hover:text-japandi-800 flex items-center gap-1">ดูทั้งหมด <ArrowRight size={14} /></button>
                  </div>
                  <div className="space-y-3">
                    {recentOrders.slice(0, 4).map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-japandi-100 hover:bg-japandi-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-japandi-100 text-japandi-600 flex items-center justify-center"><CreditCard size={18} /></div>
                          <div>
                            <p className="text-sm font-bold">{(h.order_ref || h.id || '').toUpperCase()}</p>
                            <p className="text-xs text-japandi-500">{h.ordered_at || h.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">฿{Number(h.amount).toLocaleString()}</p>
                          <p className="text-xs font-semibold text-japandi-sage">+{getOrderPoints(h).toLocaleString()} pts</p>
                        </div>
                      </div>
                    ))}
                    {recentOrders.length === 0 && <p className="text-sm text-japandi-400 text-center py-4">ยังไม่มีรายการ</p>}
                  </div>
                </div>
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold mb-4">ทางลัดจัดการระบบ (Quick Actions)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {quickActions.map(({ icon: Icon, title, sub, action }) => (
                      <button key={title} onClick={action} className="flex flex-col items-start p-4 rounded-xl border border-japandi-200 hover:border-japandi-400 hover:bg-japandi-50 transition-all text-left group">
                        <Icon size={20} className="text-japandi-600 mb-2 group-hover:text-japandi-800" />
                        <span className="font-semibold text-sm">{title}</span>
                        <span className="text-xs text-japandi-500 mt-1">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── USERS ─── */}
          {activeTab === 'users' && (
            <div className="border border-japandi-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
              {usersLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                  <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-japandi-400">
                  <Users size={36} className="opacity-30" />
                  <p className="text-sm">ไม่พบสมาชิก</p>
                  {canEdit && (
                    <button onClick={openAddModal} className="mt-2 flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900">
                      <UserPlus size={15} /> เพิ่มสมาชิกแรก
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm min-w-[700px]">
                  <thead className="bg-japandi-50 text-japandi-600 border-b border-japandi-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-4 font-bold">ชื่อลูกค้า / LINE</th>
                      <th className="px-5 py-4 font-bold text-center">ระดับ</th>
                      <th className="px-5 py-4 font-bold text-right">คะแนนสะสม</th>
                      <th className="px-5 py-4 font-bold text-right">ยอดซื้อรวม</th>
                      <th className="px-5 py-4 font-bold text-center">สถานะ</th>
                      <th className="px-5 py-4 font-bold text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-japandi-100">
                    {users.map(user => (
                      <tr key={user.id} className={`transition-colors ${user.isActive ? 'hover:bg-japandi-50/50' : 'bg-japandi-50/60 opacity-60'}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                            <div>
                              <div className="font-bold text-sm">{user.name}</div>
                              <div className="text-japandi-500 text-[10px]">Line ID: {user.lineId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            user.tier === 'Platinum' ? 'bg-japandi-800 text-japandi-100 border-japandi-900' :
                            user.tier === 'Gold'     ? 'bg-[#c09e85]/20 text-[#7f6554] border-[#c09e85]' :
                            user.tier === 'Silver'   ? 'bg-japandi-300/30 text-japandi-700 border-japandi-300' :
                                                       'bg-japandi-sage/20 text-japandi-800 border-japandi-sage'
                          }`}>{user.tier}</span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-japandi-800 text-xs tracking-wide">
                          {user.points.toLocaleString()} pts
                        </td>
                        <td className="px-5 py-4 text-right text-japandi-600 text-xs">
                          ฿{user.totalSpent.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-japandi-100 text-japandi-500 border border-japandi-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-japandi-400 inline-block" />Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {canEdit ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => openEditModal(user)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-japandi-100 hover:bg-japandi-200 text-japandi-600 transition-colors"
                                title="แก้ไขข้อมูล">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleToggleStatus(user)} disabled={statusLoading}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                                  user.isActive
                                    ? 'bg-red-50 hover:bg-red-100 text-red-500'
                                    : 'bg-green-50 hover:bg-green-100 text-green-600'
                                }`}
                                title={user.isActive ? 'ระงับสมาชิก' : 'เปิดใช้งานสมาชิก'}>
                                {user.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-japandi-400">อ่านอย่างเดียว</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── ORDERS ─── */}
          {activeTab === 'orders' && (
            <div className="border border-japandi-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                  <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-japandi-400">
                  <ClipboardList size={36} className="opacity-30" />
                  <p className="text-sm">ยังไม่มีรายการสั่งซื้อ</p>
                  {canEdit && (
                    <button onClick={openAddOrder} className="mt-2 flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900">
                      <Plus size={15} /> สร้างออเดอร์แรก
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm min-w-[1120px]">
                  <thead className="bg-japandi-50 text-japandi-600 border-b border-japandi-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-4 font-bold">เลขที่ออเดอร์</th>
                      <th className="px-4 py-4 font-bold">ลูกค้า</th>
                      <th className="px-4 py-4 font-bold">รายการสินค้า</th>
                      <th className="px-4 py-4 font-bold text-right">ยอดรวม</th>
                      <th className="px-4 py-4 font-bold text-right">ส่วนลด</th>
                      <th className="px-4 py-4 font-bold text-center">แต้มที่ได้</th>
                      <th className="px-4 py-4 font-bold">หมายเหตุ</th>
                      <th className="px-4 py-4 font-bold text-center">สถานะ</th>
                      <th className="px-4 py-4 font-bold">วันที่</th>
                      <th className="px-4 py-4 font-bold text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-japandi-100">
                    {orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-japandi-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-xs text-japandi-800 uppercase">{o.order_ref}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm">{o.user_name || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {(o.items || []).slice(0,2).map((it: any, i: number) => (
                            <div key={i} className="text-xs text-japandi-600 truncate max-w-[160px]">{it.name} x{it.qty}</div>
                          ))}
                          {(o.items || []).length > 2 && <div className="text-[10px] text-japandi-400">+{o.items.length - 2} รายการ</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-japandi-900">
                          ฿{Number(o.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-japandi-700">
                          <div className="flex flex-col items-end gap-1">
                            <span>
                              {Number(o.discount || 0) > 0
                                ? `-฿${Number(o.discount).toLocaleString()}`
                                : '—'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getOrderDiscountModeBadgeClass(o)}`}>
                              {getOrderDiscountModeLabel(o)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            getOrderPoints(o) > 0
                              ? 'bg-japandi-sage/15 text-japandi-sage border-japandi-sage/30'
                              : 'bg-japandi-100 text-japandi-400 border-japandi-200'
                          }`}>
                            +{getOrderPoints(o).toLocaleString()} pts
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate text-xs text-japandi-600" title={o.note || ''}>
                            {o.note ? String(o.note).replace(/\s+/g, ' ').trim() : '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canEdit ? (
                            <select value={o.status}
                              onChange={async e => {
                                await api.setOrderStatus(o.id, e.target.value);
                                await refreshOrderViews();
                              }}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                                o.status === 'paid'    ? 'bg-green-50 text-green-700 border-green-200' :
                                o.status === 'cancel'  ? 'bg-red-50 text-red-600 border-red-200' :
                                                         'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              <option value="pending">รอชำระ</option>
                              <option value="paid">ชำระแล้ว</option>
                              <option value="cancel">ยกเลิก</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              o.status === 'paid'    ? 'bg-green-50 text-green-700 border-green-200' :
                              o.status === 'cancel'  ? 'bg-red-50 text-red-600 border-red-200' :
                                                       'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {o.status === 'paid' ? 'ชำระแล้ว' : o.status === 'cancel' ? 'ยกเลิก' : 'รอชำระ'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-japandi-500 text-xs">
                          {new Date(o.ordered_at).toLocaleDateString('th-TH', { dateStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canEdit ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openEditOrder(o)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-japandi-100 hover:bg-japandi-200 text-japandi-600">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => setConfirmDeleteOrder(o)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-japandi-400">อ่านอย่างเดียว</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── PRODUCTS ─── */}
          {activeTab === 'products' && (
            productsLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-japandi-400">
                <ShoppingBag size={36} className="opacity-30" />
                <p className="text-sm">ยังไม่มีสินค้า</p>
                {canEdit && (
                  <button onClick={openAddProduct} className="mt-2 flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900">
                    <PackagePlus size={15} /> เพิ่มสินค้าแรก
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-japandi-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-japandi-50 text-japandi-600 border-b border-japandi-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-4 font-bold">ชื่อสินค้า</th>
                      <th className="px-5 py-4 font-bold">หมวดหมู่</th>
                      <th className="px-5 py-4 font-bold text-right">ราคา</th>
                      <th className="px-5 py-4 font-bold text-center">สถานะ</th>
                      <th className="px-5 py-4 font-bold text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-japandi-100">
                    {products.map(p => (
                      <tr key={p.id} className={`transition-colors ${p.is_active ? 'hover:bg-japandi-50/50' : 'opacity-50 bg-japandi-50/30'}`}>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-japandi-900">{p.name}</div>
                          {p.description && <div className="text-japandi-400 text-xs truncate max-w-xs">{p.description}</div>}
                        </td>
                        <td className="px-5 py-3 text-japandi-600 text-xs">{p.category || '—'}</td>
                        <td className="px-5 py-3 text-right font-bold text-japandi-900">฿{Number(p.price).toLocaleString()}</td>
                        <td className="px-5 py-3 text-center">
                          {p.is_active
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>Active</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-japandi-100 text-japandi-500 border border-japandi-200"><span className="w-1.5 h-1.5 rounded-full bg-japandi-400 inline-block"/>Inactive</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-center">
                          {canEdit ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openEditProduct(p)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-japandi-100 hover:bg-japandi-200 text-japandi-600"><Pencil size={12}/></button>
                              <button onClick={async () => { await api.setProductStatus(p.id, !p.is_active); loadProducts(); }}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.is_active ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}>
                                {p.is_active ? <ToggleRight size={13}/> : <ToggleLeft size={13}/>}
                              </button>
                              <button onClick={() => setConfirmDeleteProduct(p)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400"><Trash2 size={12}/></button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-japandi-400">อ่านอย่างเดียว</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ─── PROMOTIONS ─── */}
          {activeTab === 'promotions' && (
            promosLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {canEdit && (
                  <div className="bg-white border border-japandi-200 rounded-3xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-bold text-japandi-900">คำขอแลกแต้มรออนุมัติ</h3>
                        <p className="text-xs text-japandi-500">รายการที่ลูกค้าเลือกโหมดรอร้านยืนยัน</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-japandi-100 text-japandi-700">
                        <Clock size={13} /> {promotionRequests.length}
                      </span>
                    </div>

                    {promotionRequestsLoading ? (
                      <div className="flex items-center justify-center py-8 gap-3 text-japandi-400">
                        <Loader2 size={18} className="animate-spin" /><span className="text-sm">กำลังโหลดคำขอ...</span>
                      </div>
                    ) : promotionRequestsError ? (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">
                        {promotionRequestsError}
                      </div>
                    ) : promotionRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-japandi-400 rounded-2xl border border-dashed border-japandi-200 bg-japandi-50/40">
                        <CheckCircle size={28} className="opacity-30" />
                        <p className="text-sm">ไม่มีคำขอรออนุมัติในตอนนี้</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {promotionRequests.map(request => (
                          <div key={request.id} className="rounded-2xl border border-japandi-200 bg-japandi-50/70 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-japandi-900 truncate">{request.promotionTitle}</p>
                                <p className="text-xs text-japandi-500 mt-1 truncate">
                                  {request.userName} · {request.lineId}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <Clock size={11} /> Pending
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                              <div className="rounded-xl bg-white border border-japandi-100 px-3 py-2.5">
                                <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider">แต้มที่ใช้</p>
                                <p className="font-bold text-japandi-900 text-sm mt-0.5">{Number(request.pointsRequired).toLocaleString()} pts</p>
                              </div>
                              <div className="rounded-xl bg-white border border-japandi-100 px-3 py-2.5">
                                <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider">เวลาที่ขอ</p>
                                <p className="font-bold text-japandi-900 text-sm mt-0.5">
                                  {new Date(request.requestedAt).toLocaleString('th-TH')}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => handleRejectPromotionRequest(request)}
                                disabled={promotionRequestActionId === request.id}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 bg-white text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                              >
                                {promotionRequestActionId === request.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                ปฏิเสธ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprovePromotionRequest(request)}
                                disabled={promotionRequestActionId === request.id}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-japandi-800 text-white text-sm font-semibold hover:bg-japandi-900 disabled:opacity-60"
                              >
                                {promotionRequestActionId === request.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                อนุมัติ
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {promotions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-japandi-400">
                    <Tag size={36} className="opacity-30" />
                    <p className="text-sm">ยังไม่มีโปรโมชั่น</p>
                    {canEdit && (
                      <button onClick={openAddPromo} className="mt-2 flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900">
                        <Plus size={15} /> สร้างโปรโมชั่นแรก
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map(promo => (
                      <div key={promo.id} className={`bg-white border shadow-sm rounded-3xl p-5 relative overflow-hidden flex flex-col transition-all ${promo.status === 'inactive' ? 'border-japandi-200 opacity-70' : 'border-japandi-200 hover:border-japandi-400'}`}>

                        {/* Status badge */}
                        <div className={`absolute top-0 right-0 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl ${promo.status === 'inactive' ? 'bg-japandi-400' : 'bg-green-500'}`}>
                          {promo.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                        </div>

                        <div className="w-12 h-12 bg-japandi-100 text-japandi-700 rounded-2xl flex items-center justify-center mb-4 shrink-0">
                          <Tag size={20} />
                        </div>
                        <div className="flex items-start justify-between gap-2 mb-1.5 pr-2">
                          <h3 className="font-bold text-japandi-900 leading-snug">{promo.title}</h3>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            (promo.redeem_mode || promo.redeemMode) === 'manual'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {(promo.redeem_mode || promo.redeemMode) === 'manual' ? 'รออนุมัติ' : 'แลกทันที'}
                          </span>
                        </div>
                        <p className="text-japandi-500 text-xs mb-4 line-clamp-2 flex-1">{promo.description || '—'}</p>

                        <div className="pt-3 border-t border-japandi-100 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-japandi-600">ใช้ <span className="text-japandi-800 font-bold text-[15px] mx-1">{promo.points_required}</span> แต้ม</div>
                            {promo.expires_at && (
                              <span className="text-[10px] text-japandi-400">หมดอายุ {new Date(promo.expires_at).toLocaleDateString('th-TH')}</span>
                            )}
                          </div>

                          {/* Action buttons */}
                          {canEdit ? (
                            <div className="flex gap-2">
                              <button onClick={() => openEditPromo(promo)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-japandi-200 text-japandi-600 hover:bg-japandi-50 text-xs font-semibold transition-colors">
                                <Pencil size={13} /> แก้ไข
                              </button>
                              <button onClick={() => handleTogglePromoStatus(promo)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                                  promo.status === 'active'
                                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                    : 'border-green-200 text-green-700 hover:bg-green-50'
                                }`}>
                                {promo.status === 'active' ? <><ToggleRight size={13} />ระงับ</> : <><ToggleLeft size={13} />เปิดใช้</>}
                              </button>
                              <button onClick={() => setConfirmDeletePromo(promo)}
                                className="w-9 flex items-center justify-center rounded-xl border border-red-100 text-red-400 hover:bg-red-50 hover:border-red-200 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-japandi-500">อ่านอย่างเดียว</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* ─── LEVELS ─── */}
          {activeTab === 'levels' && (
            tiersDbLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">Point Expiry</p>
                      <h3 className="font-bold text-japandi-900 text-base mt-1">อายุแต้มของบริษัท</h3>
                      <p className="text-sm text-japandi-500 mt-1">กำหนดว่าแต้มที่ได้แต่ละครั้งจะหมดอายุหลังจากกี่วัน</p>
                    </div>
                    <button
                      type="button"
                      onClick={saveCompanySettings}
                      disabled={companySettingsSaving || companySettingsLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-japandi-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-japandi-900 disabled:opacity-60"
                    >
                      {companySettingsSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                      บันทึก
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">แต้มหมดอายุหลัง (วัน)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={companySettings.pointExpiryDays}
                        onChange={e => setCompanySettings(p => ({ ...p, pointExpiryDays: parseInt(e.target.value, 10) > 0 ? parseInt(e.target.value, 10) : 365 }))}
                        className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"
                      />
                    </div>
                    <div className="self-end text-xs text-japandi-500">
                      <p>ค่าเริ่มต้น 365 วัน</p>
                      <p className="mt-1">อัปเดตล่าสุด: {companySettings.updatedAt ? new Date(companySettings.updatedAt).toLocaleString('th-TH') : '—'}</p>
                    </div>
                  </div>
                  {companySettingsError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                      {companySettingsError}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {tiersDb.map((tier, idx) => {
                    const bens = normalizeTierBenefits(tier.benefits);
                    const bahtPerPoint = getTierBahtPerPoint(tier);
                    const discountPercent = getTierDiscountPercent(tier);
                    const durationDays = getTierDurationDays(tier);
                    return (
                      <div key={tier.id} className="bg-white border border-japandi-200 rounded-2xl p-5 shadow-sm flex gap-4 relative overflow-hidden">
                        {/* Color strip */}
                        <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: tier.color || '#b9b99d' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">Level {idx + 1}</span>
                              <h3 className="font-bold text-japandi-900 text-base leading-tight">{tier.name}</h3>
                            </div>
                            {canManageTiers && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => openEditTier(tier)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-japandi-100 hover:bg-japandi-200 text-japandi-600 transition-colors" title="แก้ไข">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => setConfirmDeleteTier(tier)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 transition-colors" title="ลบ">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: tier.color || '#b9b99d', backgroundColor: (tier.color || '#b9b99d') + '18' }}>
                              <Banknote size={20} style={{ color: tier.color || '#b9b99d' }} className="shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-japandi-500 uppercase tracking-wider">อัตราสะสมแต้ม</p>
                                <p className="font-black text-japandi-900 text-base leading-tight">
                                  ทุก ฿{Number(bahtPerPoint).toLocaleString()}
                                  <span className="text-japandi-400 font-normal text-sm"> = 1 แต้ม</span>
                                </p>
                                <p className="text-[10px] text-japandi-500 truncate">ตัวคูณ x{tier.multiplier} → ฿{(Number(bahtPerPoint) / Number(tier.multiplier)).toFixed(2)}/แต้ม</p>
                              </div>
                            </div>

                            <div className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: `${tier.color || '#b9b99d'}55`, backgroundColor: `${tier.color || '#b9b99d'}14` }}>
                              <Percent size={20} style={{ color: tier.color || '#b9b99d' }} className="shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-japandi-500 uppercase tracking-wider">ส่วนลดสมาชิก</p>
                                <p className="font-black text-japandi-900 text-base leading-tight">
                                  {Number(discountPercent).toFixed(2).replace(/\.00$/, '')}%
                                  <span className="text-japandi-400 font-normal text-sm"> ต่อบิล</span>
                                </p>
                                <p className="text-[10px] text-japandi-500 truncate">ซื้อ ฿1,000 → ลด ฿{(1000 * Number(discountPercent) / 100).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                            <div className="bg-japandi-50 rounded-xl px-3 py-2">
                              <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider mb-0.5">คะแนนขั้นต่ำ</p>
                              <p className="font-bold text-japandi-900 text-sm">{Number(tier.min_points).toLocaleString()}</p>
                            </div>
                            <div className="bg-japandi-50 rounded-xl px-3 py-2">
                              <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider mb-0.5">ตัวคูณ</p>
                              <p className="font-bold text-japandi-900 text-sm">x{tier.multiplier}</p>
                            </div>
                            <div className="bg-japandi-50 rounded-xl px-3 py-2 flex items-center gap-2">
                              <Percent size={14} className="text-japandi-500 shrink-0" />
                              <div>
                                <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider mb-0.5">ส่วนลด</p>
                                <p className="font-bold text-japandi-900 text-sm">{Number(discountPercent).toFixed(2).replace(/\.00$/, '')}%</p>
                              </div>
                            </div>
                            <div className="bg-japandi-50 rounded-xl px-3 py-2">
                              <p className="text-[9px] font-bold text-japandi-400 uppercase tracking-wider mb-0.5">อายุ tier</p>
                              <p className="font-bold text-japandi-900 text-sm">{durationDays > 0 ? `${durationDays} วัน` : 'ไม่หมดอายุ'}</p>
                            </div>
                          </div>

                          {bens.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-wider mb-1">สิทธิพิเศษอื่นๆ</p>
                              <ul className="space-y-0.5">
                                {bens.map((b, i) => (
                                  <li key={i} className="flex items-center gap-1.5 text-xs text-japandi-700">
                                    <span className="w-1 h-1 rounded-full bg-japandi-400 shrink-0" />{b}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {canManageTiers && (
                    <button onClick={openAddTier}
                      className="border-2 border-dashed border-japandi-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-japandi-400 hover:border-japandi-400 hover:text-japandi-600 hover:bg-japandi-50 transition-all min-h-[140px]">
                      <Plus size={24} />
                      <span className="text-sm font-semibold">เพิ่มระดับใหม่</span>
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {/* ─── STAFF ─── */}
          {activeTab === 'staff' && (
            staffLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-japandi-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm">กำลังโหลด...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-japandi-900">บัญชีผู้ใช้ทั้งหมด</h3>
                    <p className="text-xs text-japandi-500">กำหนดสิทธิ์ admin, manager, user และปิดใช้งานบัญชีได้</p>
                  </div>
                  <button onClick={openAddStaff}
                    className="flex items-center gap-2 bg-japandi-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-japandi-900 shadow-md">
                    <UserPlus size={15} /> เพิ่มบัญชี
                  </button>
                </div>

                {staffAccounts.length === 0 ? (
                  <div className="bg-white border border-japandi-200 rounded-2xl p-10 text-center text-japandi-400 shadow-sm">
                    ยังไม่มีบัญชี staff
                  </div>
                ) : (
                  <div className="border border-japandi-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-left text-sm min-w-[760px]">
                      <thead className="bg-japandi-50 text-japandi-600 border-b border-japandi-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-5 py-4 font-bold">ชื่อผู้ใช้</th>
                          <th className="px-5 py-4 font-bold">ชื่อที่แสดง</th>
                          <th className="px-5 py-4 font-bold text-center">Role</th>
                          <th className="px-5 py-4 font-bold">ล็อกอินล่าสุด</th>
                          <th className="px-5 py-4 font-bold text-center">สถานะ</th>
                          <th className="px-5 py-4 font-bold text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-japandi-100">
                        {staffAccounts.map(staff => (
                          <tr key={staff.id} className={`transition-colors ${staff.isActive ? 'hover:bg-japandi-50/50' : 'opacity-60 bg-japandi-50/40'}`}>
                            <td className="px-5 py-3">
                              <div className="font-semibold text-japandi-900">{staff.username}</div>
                              <div className="text-[10px] text-japandi-400">ID: {staff.id}</div>
                            </td>
                            <td className="px-5 py-3 text-japandi-700">{staff.displayName}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                staff.role === 'admin'
                                  ? 'bg-japandi-800 text-white border-japandi-900'
                                  : staff.role === 'manager'
                                    ? 'bg-[#c09e85]/20 text-[#7f6554] border-[#c09e85]'
                                    : 'bg-japandi-100 text-japandi-600 border-japandi-200'
                              }`}>
                                {staff.role}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-japandi-500 text-xs">
                              {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString('th-TH') : 'ยังไม่เคยเข้าใช้งาน'}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {staff.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-japandi-100 text-japandi-500 border border-japandi-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-japandi-400 inline-block" />Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => openEditStaff(staff)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-japandi-100 hover:bg-japandi-200 text-japandi-600 transition-colors"
                                  title="แก้ไขบัญชี">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => staff.isActive ? setConfirmDeactivateStaff(staff) : handleToggleStaffActive(staff)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                                    staff.isActive ? 'bg-red-50 hover:bg-red-100 text-red-500' : 'bg-green-50 hover:bg-green-100 text-green-600'
                                  }`}
                                  title={staff.isActive ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}>
                                  {staff.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* ─── ADD / EDIT MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-japandi-200 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-japandi-800 rounded-xl flex items-center justify-center">
                  {modalMode === 'add' ? <UserPlus size={17} className="text-white" /> : <Pencil size={16} className="text-white" />}
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{modalMode === 'add' ? 'เพิ่มสมาชิกใหม่' : 'แก้ไขข้อมูลสมาชิก'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest font-semibold">
                    {modalMode === 'add' ? 'New Member' : editingUser?.lineId}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full">
                <X size={16} />
              </button>
            </div>

            <form id="member-edit-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">Line ID <span className="text-red-400">*</span></label>
                <input name="lineId" value={form.lineId} onChange={handleFormChange} required placeholder="@line_username"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
                {modalMode === 'edit' && (
                  <p className="text-[10px] font-medium text-japandi-400 leading-relaxed">
                    ใช้ผูกกับ LINE / LIFF ของสมาชิก ถ้าเปลี่ยนแล้วควรตรวจสอบว่าตรงกับบัญชีเดิม
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อ-นามสกุล <span className="text-red-400">*</span></label>
                <input name="name" value={form.name} onChange={handleFormChange} required placeholder="ระบุชื่อ-นามสกุล"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">เบอร์โทร</label>
                  <input name="phone" value={form.phone} onChange={handleFormChange} placeholder="08X-XXX-XXXX"
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">วันเกิด</label>
                  <input
                    name="birthday"
                    type="text"
                    value={form.birthday}
                    onChange={handleFormChange}
                    placeholder="dd/MM/yyyy"
                    inputMode="numeric"
                    autoComplete="bday"
                    maxLength={10}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">อีเมล</label>
                <input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="example@email.com"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              {/* ─── Edit-only: tier / points / totalSpent ─── */}
              {modalMode === 'edit' && (
                <div className="space-y-3 pt-2 border-t border-japandi-100">
                  <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">ข้อมูลการใช้งาน (Manual Override)</p>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ระดับสมาชิก (Tier)</label>
                    <select name="tier" value={form.tier}
                      onChange={e => setForm(prev => ({ ...prev, tier: e.target.value }))}
                      className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400">
                      {['Standard', 'Silver', 'Gold', 'Platinum'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">คะแนนสะสม (Points)</label>
                      <input name="points" type="number" min="0" value={form.points}
                        onChange={handleFormChange}
                        className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ยอดซื้อรวม (฿)</label>
                      <input name="totalSpent" type="number" min="0" step="0.01" value={form.totalSpent}
                        onChange={handleFormChange}
                        className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                    </div>
                  </div>
                </div>
              )}

              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{formError}</div>}
            </form>

            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-japandi-100 bg-white/95 backdrop-blur-sm">
              <div className="flex gap-3">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" form="member-edit-form" disabled={formLoading}
                  className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {formLoading ? <><Loader2 size={15} className="animate-spin" />กำลังบันทึก...</> : modalMode === 'add' ? 'บันทึกสมาชิก' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM INACTIVE DIALOG ─── */}
      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <ToggleRight size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-japandi-900">ระงับสมาชิก</h3>
                <p className="text-xs text-japandi-500">การดำเนินการนี้สามารถย้อนกลับได้</p>
              </div>
            </div>
            <p className="text-sm text-japandi-700 mb-6">
              ต้องการระงับการใช้งานสมาชิก <span className="font-bold text-japandi-900">{confirmUser.name}</span> ใช่ไหม?
              <br /><span className="text-xs text-japandi-400 mt-1 block">สมาชิกจะไม่แสดงในรายการหลัก แต่ยังคงข้อมูลไว้ในระบบ</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUser(null)}
                className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={confirmInactive} disabled={statusLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {statusLoading ? <Loader2 size={14} className="animate-spin" /> : null} ยืนยันระงับ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRODUCT ADD/EDIT MODAL ─── */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-japandi-200 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-japandi-800 rounded-xl flex items-center justify-center">
                  {editingProduct ? <Pencil size={16} className="text-white"/> : <PackagePlus size={17} className="text-white"/>}
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest font-semibold">Product</p>
                </div>
              </div>
              <button onClick={() => setShowProductModal(false)} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full"><X size={16}/></button>
            </div>
            <form onSubmit={handleProductSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อสินค้า <span className="text-red-400">*</span></label>
                <input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} required placeholder="ชื่อสินค้า"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ราคา (฿)</label>
                  <input type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">หมวดหมู่</label>
                  <input value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} placeholder="เช่น เครื่องดื่ม"
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">รายละเอียด</label>
                <textarea value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  placeholder="รายละเอียดสินค้า..."
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400 resize-none"/>
              </div>
              {productFormError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{productFormError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={productFormLoading} className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {productFormLoading ? <><Loader2 size={15} className="animate-spin"/>บันทึก...</> : editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ORDER ADD/EDIT MODAL ─── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOrderModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-japandi-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-japandi-800 rounded-xl flex items-center justify-center">
                  {editingOrder ? <Pencil size={16} className="text-white"/> : <Plus size={17} className="text-white"/>}
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{editingOrder ? 'แก้ไขออเดอร์' : 'สร้างออเดอร์ใหม่'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest">{editingOrder?.order_ref || 'New Order'}</p>
                </div>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full"><X size={16}/></button>
            </div>

            <form onSubmit={handleOrderSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Customer + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ลูกค้า <span className="text-red-400">*</span></label>
                  <select value={orderForm.userId} onChange={e => {
                    const nextUserId = e.target.value;
                    if (!nextUserId) {
                      setOrderDiscountMode('manual');
                      setOrderForm(p => ({ ...p, userId: '', discount: '0' }));
                      return;
                    }
                    applyMemberDiscountForOrder(nextUserId);
                  }} required
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400">
                    <option value="">-- เลือกลูกค้า --</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สถานะ</label>
                  <select value={orderForm.status} onChange={e => setOrderForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400">
                    <option value="pending">รอชำระ</option>
                    <option value="paid">ชำระแล้ว</option>
                    <option value="cancel">ยกเลิก</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">รายการสินค้า <span className="text-red-400">*</span></label>
                <div className="bg-japandi-50 rounded-2xl p-3 space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-[10px] font-bold text-japandi-400 uppercase px-1">
                    <span>สินค้า</span><span>ราคา/ชิ้น</span><span>จำนวน</span><span className="w-7"/>
                  </div>
                  {orderForm.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                      <div className="relative">
                        <select value={it.productId}
                          onChange={e => e.target.value ? pickProduct(i, e.target.value) : setOrderItem(i, 'productId', '')}
                          className="w-full bg-white border border-japandi-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-japandi-400">
                          <option value="">-- เลือก หรือพิมพ์เอง --</option>
                          {products.filter(p => p.is_active).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (฿{Number(p.price).toLocaleString()})</option>
                          ))}
                        </select>
                        {!it.productId && (
                          <input value={it.name} onChange={e => setOrderItem(i, 'name', e.target.value)} placeholder="หรือพิมพ์ชื่อสินค้า"
                            className="mt-1 w-full bg-white border border-japandi-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400"/>
                        )}
                        {it.productId && <div className="mt-1 text-xs text-japandi-600 px-1 truncate">{it.name}</div>}
                      </div>
                      <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => setOrderItem(i, 'unitPrice', e.target.value)}
                        className="bg-white border border-japandi-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-japandi-400 text-right"/>
                      <input type="number" min="1" value={it.qty} onChange={e => setOrderItem(i, 'qty', e.target.value)}
                        className="bg-white border border-japandi-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-japandi-400 text-center"/>
                      <button type="button" onClick={() => removeOrderItem(i)} disabled={orderForm.items.length <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 disabled:opacity-30 shrink-0">
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addOrderItem}
                    className="w-full py-2 border border-dashed border-japandi-300 rounded-xl text-xs font-semibold text-japandi-500 hover:border-japandi-400 hover:text-japandi-700 flex items-center justify-center gap-1">
                    <Plus size={13}/> เพิ่มรายการสินค้า
                  </button>
                </div>
                {/* Total */}
                <div className="flex items-center justify-end gap-3 px-1">
                  <span className="text-xs font-semibold text-japandi-500">ยอดรวม:</span>
                  <span className="text-xl font-black text-japandi-900">฿{orderSubtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ส่วนลด</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderForm.discount}
                  onChange={e => {
                    setOrderDiscountMode('manual');
                    setOrderForm(p => ({ ...p, discount: e.target.value }));
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400"
                />
                <p className="text-[11px] text-japandi-400 leading-relaxed">
                  ส่วนลดจะถูกหักจากยอดรวมก่อนคำนวณยอดสุทธิและแต้มสะสม
                </p>
                {selectedOrderTierDiscountPercent > 0 && (
                  <div className="rounded-xl border border-japandi-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-japandi-400 uppercase tracking-widest">ส่วนลดตามระดับสมาชิก</p>
                      <p className="text-xs text-japandi-600 mt-0.5 truncate">
                        {selectedOrderUser?.name || 'ลูกค้าที่เลือก'} · {selectedOrderUser?.tier} {selectedOrderTierDiscountPercent}%
                      </p>
                      <p className="text-[10px] text-japandi-400 mt-1">
                        {orderDiscountMode === 'member' ? 'กำลังใช้ส่วนลดอัตโนมัติ' : 'กดปุ่มเพื่อใช้ส่วนลดอัตโนมัติ'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyMemberDiscountForOrder(orderForm.userId, orderForm.items)}
                      className="shrink-0 rounded-lg border border-japandi-200 px-3 py-2 text-[11px] font-bold text-japandi-700 hover:bg-japandi-50"
                    >
                      ใช้ ฿{selectedOrderTierDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </button>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-japandi-200 bg-japandi-50/80 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-japandi-500 font-medium">ยอดก่อนส่วนลด</span>
                  <span className="font-bold text-japandi-900">฿{orderSubtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-japandi-500 font-medium">ส่วนลด</span>
                  <span className="font-bold text-japandi-700">-฿{orderDiscount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-japandi-200">
                  <span className="text-japandi-700 font-bold">ยอดสุทธิ</span>
                  <span className="text-xl font-black text-japandi-900">฿{orderNetTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">หมายเหตุ</label>
                <textarea value={orderForm.note} onChange={e => setOrderForm(p => ({ ...p, note: e.target.value }))} rows={2}
                  placeholder="หมายเหตุเพิ่มเติม..."
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400 resize-none"/>
              </div>

              {editingOrder?.slip_url && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สลิปแนบ</label>
                    <a
                      href={`/api/admin/orders/${editingOrder.id}/slip-image?company=${encodeURIComponent(company.code)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-japandi-700 hover:text-japandi-900"
                    >
                      เปิดเต็มจอ
                    </a>
                  </div>
                  <div className="rounded-2xl border border-japandi-200 bg-japandi-50 overflow-hidden">
                    <img
                      src={`/api/admin/orders/${editingOrder.id}/slip-image?company=${encodeURIComponent(company.code)}`}
                      alt="Slip attachment"
                      className="w-full max-h-80 object-contain bg-white"
                    />
                  </div>
                </div>
              )}

              {orderFormError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{orderFormError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={orderFormLoading} className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {orderFormLoading ? <><Loader2 size={15} className="animate-spin"/>บันทึก...</> : editingOrder ? 'บันทึกการแก้ไข' : 'สร้างออเดอร์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE ORDER ─── */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteOrder(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><Trash2 size={20} className="text-red-500"/></div>
              <div><h3 className="font-bold">ลบออเดอร์</h3><p className="text-xs text-japandi-500">ไม่สามารถย้อนกลับได้</p></div>
            </div>
            <p className="text-sm text-japandi-700 mb-6">ต้องการลบ <span className="font-bold">{confirmDeleteOrder.order_ref}</span> ใช่ไหม?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteOrder(null)} className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={async () => {
                await api.deleteOrder(confirmDeleteOrder.id);
                setConfirmDeleteOrder(null);
                await refreshOrderViews();
              }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE PRODUCT ─── */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteProduct(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><Trash2 size={20} className="text-red-500"/></div>
              <div><h3 className="font-bold">ลบสินค้า</h3><p className="text-xs text-japandi-500">ไม่สามารถย้อนกลับได้</p></div>
            </div>
            <p className="text-sm text-japandi-700 mb-6">ต้องการลบ <span className="font-bold">"{confirmDeleteProduct.name}"</span> ใช่ไหม?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteProduct(null)} className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={() => handleDeleteProduct(confirmDeleteProduct)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TIER ADD / EDIT MODAL ─── */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTierModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-japandi-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: tierForm.color }}>
                  <Award size={17} className="text-white drop-shadow" />
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{editingTier ? 'แก้ไขระดับสมาชิก' : 'เพิ่มระดับใหม่'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest font-semibold">Loyalty Tier</p>
                </div>
              </div>
              <button onClick={() => setShowTierModal(false)} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTierFormSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อระดับ <span className="text-red-400">*</span></label>
                  <input value={tierForm.name} onChange={e => setTierForm(p => ({ ...p, name: e.target.value }))} required
                    placeholder="เช่น Standard, VIP, Diamond"
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">คะแนนขั้นต่ำ</label>
                  <input type="number" min="0" value={tierForm.minPoints}
                    onChange={e => setTierForm(p => ({ ...p, minPoints: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ตัวคูณ (x)</label>
                  <input type="number" min="0.1" step="0.1" value={tierForm.multiplier}
                    onChange={e => setTierForm(p => ({ ...p, multiplier: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">อายุ tier (วัน)</label>
                  <input type="number" min="0" step="1" value={tierForm.durationDays}
                    onChange={e => setTierForm(p => ({ ...p, durationDays: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                </div>
              </div>

              {/* อัตราสะสมแต้ม */}
              <div className="rounded-2xl border-2 border-dashed border-japandi-200 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote size={16} className="text-japandi-600" />
                  <span className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">อัตราสะสมแต้ม</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-japandi-700 font-medium whitespace-nowrap">ทุก</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-japandi-500 text-sm font-bold">฿</span>
                    <input type="number" min="1" step="1" value={tierForm.bahtPerPoint}
                      onChange={e => setTierForm(p => ({ ...p, bahtPerPoint: e.target.value }))}
                      className="w-full bg-white border border-japandi-200 rounded-xl pl-7 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                  </div>
                  <span className="text-sm text-japandi-700 font-medium whitespace-nowrap">= 1 แต้ม</span>
                </div>
                <p className="text-xs text-japandi-400 pl-1">
                  ตัวอย่าง: ซื้อ ฿1,000 → ได้{' '}
                  <span className="font-bold text-japandi-700">
                    {Math.floor(1000 / (parseFloat(tierForm.bahtPerPoint) || 10))} แต้ม
                  </span>
                  {parseFloat(tierForm.multiplier) > 1 && (
                    <span className="text-japandi-500"> (x{tierForm.multiplier} = {Math.floor(1000 / (parseFloat(tierForm.bahtPerPoint) || 10) * parseFloat(tierForm.multiplier))} แต้ม)</span>
                  )}
                </p>
              </div>

              {/* ส่วนลดสมาชิก */}
              <div className="rounded-2xl border-2 border-dashed border-japandi-200 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Percent size={16} className="text-japandi-600" />
                  <span className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ส่วนลดสมาชิก</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-japandi-700 font-medium whitespace-nowrap">รับส่วนลด</span>
                  <div className="relative flex-1">
                    <input type="number" min="0" step="0.1" value={tierForm.discountPercent}
                      onChange={e => setTierForm(p => ({ ...p, discountPercent: e.target.value }))}
                      className="w-full bg-white border border-japandi-200 rounded-xl pl-4 pr-10 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-japandi-500 text-sm font-bold">%</span>
                  </div>
                </div>
                <p className="text-xs text-japandi-400 pl-1">
                  ตัวอย่าง: ซื้อ ฿1,000 → ลด ฿
                  <span className="font-bold text-japandi-700">
                    {(1000 * (parseFloat(tierForm.discountPercent) || 0) / 100).toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สีบัตรสมาชิก</label>
                  <div className="flex items-center gap-3">
                    <div className="relative border border-japandi-300 rounded-xl overflow-hidden h-[44px] w-20 shrink-0">
                      <input type="color" value={tierForm.color} onChange={e => setTierForm(p => ({ ...p, color: e.target.value }))}
                        className="w-full h-16 absolute -top-2 -left-2 cursor-pointer scale-150" />
                    </div>
                    <span className="text-sm font-mono text-japandi-600">{tierForm.color}</span>
                    <div className="flex-1 h-10 rounded-xl border border-japandi-200" style={{ backgroundColor: tierForm.color }} />
                  </div>
                </div>
              </div>

              {/* Benefits list */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สิทธิพิเศษอื่นๆ</label>
                {tierForm.benefits.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={b} placeholder={`สิทธิ์ที่ ${i + 1}`}
                      onChange={e => setTierForm(p => ({ ...p, benefits: p.benefits.map((x, j) => j === i ? e.target.value : x) }))}
                      className="flex-1 bg-japandi-50 border border-japandi-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
                    <button type="button" onClick={() => setTierForm(p => ({ ...p, benefits: p.benefits.filter((_, j) => j !== i) }))}
                      className="w-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-400 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setTierForm(p => ({ ...p, benefits: [...p.benefits, ''] }))}
                  className="w-full py-2 border border-dashed border-japandi-200 rounded-xl text-xs font-semibold text-japandi-400 hover:border-japandi-400 hover:text-japandi-600 transition-colors flex items-center justify-center gap-1">
                  <Plus size={13} /> เพิ่มสิทธิ์
                </button>
              </div>

              {tierFormError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{tierFormError}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTierModal(false)}
                  className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={tierFormLoading}
                  className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {tierFormLoading ? <><Loader2 size={15} className="animate-spin" />กำลังบันทึก...</> : editingTier ? 'บันทึกการแก้ไข' : 'สร้างระดับ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE TIER ─── */}
      {confirmDeleteTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteTier(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-japandi-900">ลบระดับสมาชิก</h3>
                <p className="text-xs text-japandi-500">ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <p className="text-sm text-japandi-700 mb-1">
              ต้องการลบระดับ <span className="font-bold text-japandi-900">"{confirmDeleteTier.name}"</span> ใช่ไหม?
            </p>
            <p className="text-xs text-japandi-400 mb-6">สมาชิกที่อยู่ระดับนี้ยังคงข้อมูลไว้ในระบบ</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteTier(null)}
                className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={handleDeleteTier} disabled={deleteTierLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {deleteTierLoading ? <Loader2 size={14} className="animate-spin" /> : null} ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROMOTION ADD / EDIT MODAL ─── */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-full flex items-start md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPromoModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-japandi-200 overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-japandi-800 rounded-xl flex items-center justify-center">
                  {editingPromo ? <Pencil size={16} className="text-white" /> : <Plus size={17} className="text-white" />}
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{editingPromo ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest font-semibold">Promotion</p>
                </div>
              </div>
              <button onClick={() => setShowPromoModal(false)} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePromoSubmit} className="px-6 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อโปรโมชั่น <span className="text-red-400">*</span></label>
                <input value={promoForm.title} onChange={e => setPromoForm(p => ({ ...p, title: e.target.value }))} required
                  placeholder="เช่น ส่วนลด 100 บาท"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">รายละเอียด</label>
                <textarea value={promoForm.description} onChange={e => setPromoForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  placeholder="อธิบายรายละเอียดโปรโมชั่น..."
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">แต้มที่ใช้</label>
                  <input type="number" min="0" value={promoForm.pointsRequired}
                    onChange={e => setPromoForm(p => ({ ...p, pointsRequired: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">วันหมดอายุ</label>
                  <input type="date" value={promoForm.expiresAt}
                    onChange={e => setPromoForm(p => ({ ...p, expiresAt: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">โหมดแลกแต้ม</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'auto', title: 'แลกทันที', desc: 'ตัดแต้มทันทีหลังลูกค้ายืนยัน' },
                    { value: 'manual', title: 'รออนุมัติ', desc: 'สร้างคำขอให้ร้านกดยืนยันก่อน' },
                  ] as const).map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPromoForm(p => ({ ...p, redeemMode: item.value }))}
                      className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                        promoForm.redeemMode === item.value
                          ? 'border-japandi-800 bg-japandi-800 text-white shadow-md'
                          : 'border-japandi-200 bg-white text-japandi-700 hover:bg-japandi-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm">{item.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                          {item.value === 'auto' ? 'AUTO' : 'MANUAL'}
                        </span>
                      </div>
                      <p className={`mt-1 text-[11px] leading-relaxed ${promoForm.redeemMode === item.value ? 'text-white/80' : 'text-japandi-500'}`}>
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สถานะ</label>
                <div className="flex gap-3">
                  {(['active', 'inactive'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setPromoForm(p => ({ ...p, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors ${promoForm.status === s
                        ? s === 'active' ? 'bg-green-500 border-green-500 text-white' : 'bg-japandi-400 border-japandi-400 text-white'
                        : 'border-japandi-200 text-japandi-500 hover:bg-japandi-50'}`}>
                      {s === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  ))}
                </div>
              </div>

              {promoFormError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{promoFormError}</div>}

            <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowPromoModal(false)}
                  className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={promoFormLoading}
                  className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {promoFormLoading ? <><Loader2 size={15} className="animate-spin" />กำลังบันทึก...</> : editingPromo ? 'บันทึกการแก้ไข' : 'สร้างโปรโมชั่น'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE PROMOTION ─── */}
      {confirmDeletePromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeletePromo(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-japandi-900">ลบโปรโมชั่น</h3>
                <p className="text-xs text-japandi-500">ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <p className="text-sm text-japandi-700 mb-6">
              ต้องการลบโปรโมชั่น <span className="font-bold text-japandi-900">"{confirmDeletePromo.title}"</span> ใช่ไหม?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeletePromo(null)}
                className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={handleDeletePromo} disabled={deletePromoLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {deletePromoLoading ? <Loader2 size={14} className="animate-spin" /> : null} ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STAFF MODAL ─── */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStaffModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md border border-japandi-200 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-japandi-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-japandi-800 rounded-xl flex items-center justify-center">
                  <BadgeCheck size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-japandi-900 text-base">{editingStaff ? 'แก้ไขบัญชี staff' : 'เพิ่มบัญชี staff'}</h2>
                  <p className="text-[11px] text-japandi-500 uppercase tracking-widest font-semibold">
                    {editingStaff ? editingStaff.username : 'New Account'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowStaffModal(false)} className="w-8 h-8 flex items-center justify-center bg-japandi-100 hover:bg-japandi-200 text-japandi-600 rounded-full">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStaffSubmit} className="px-6 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อที่แสดง <span className="text-red-400">*</span></label>
                <input value={staffForm.displayName} onChange={e => setStaffForm(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="ชื่อที่จะแสดงในระบบ"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">ชื่อผู้ใช้ <span className="text-red-400">*</span></label>
                <input value={staffForm.username} onChange={e => setStaffForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="username"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">
                  รหัสผ่าน {editingStaff ? <span className="text-japandi-400 normal-case">(เว้นว่างถ้าไม่เปลี่ยน)</span> : <span className="text-red-400">*</span>}
                </label>
                <input type="password" value={staffForm.password} onChange={e => setStaffForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-japandi-400 placeholder-japandi-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">Role</label>
                  <select value={staffForm.role} onChange={e => setStaffForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-japandi-50 border border-japandi-200 rounded-xl px-4 py-3 text-sm text-japandi-900 focus:outline-none focus:ring-2 focus:ring-japandi-400">
                    <option value="user">user</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-japandi-600 uppercase tracking-widest">สถานะ</label>
                  <button
                    type="button"
                    onClick={() => setStaffForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      staffForm.isActive
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-japandi-100 border-japandi-200 text-japandi-500'
                    }`}
                  >
                    {staffForm.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              {staffFormError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">{staffFormError}</div>}

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowStaffModal(false)}
                  className="flex-1 py-3 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
                <button type="submit" disabled={staffFormLoading}
                  className="flex-1 py-3 bg-japandi-800 text-white rounded-xl text-sm font-bold hover:bg-japandi-900 shadow-md disabled:opacity-60 flex items-center justify-center gap-2">
                  {staffFormLoading ? <><Loader2 size={15} className="animate-spin" />กำลังบันทึก...</> : editingStaff ? 'บันทึกการแก้ไข' : 'สร้างบัญชี'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DEACTIVATE STAFF ─── */}
      {confirmDeactivateStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeactivateStaff(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-japandi-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <BadgeCheck size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-japandi-900">ระงับบัญชี staff</h3>
                <p className="text-xs text-japandi-500">บัญชีนี้จะไม่สามารถเข้าสู่ระบบได้</p>
              </div>
            </div>
            <p className="text-sm text-japandi-700 mb-6">
              ต้องการระงับบัญชี <span className="font-bold text-japandi-900">{confirmDeactivateStaff.displayName}</span> ใช่ไหม?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeactivateStaff(null)}
                className="flex-1 py-2.5 border border-japandi-200 text-japandi-700 rounded-xl text-sm font-semibold hover:bg-japandi-50">ยกเลิก</button>
              <button onClick={async () => { await handleToggleStaffActive(confirmDeactivateStaff); setConfirmDeactivateStaff(null); }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">
                ยืนยันระงับ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
