'use client';

import { useCustomer, usePricingTable } from 'autumn-js/react';
import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, CheckCircle, AlertCircle, Loader2, User, Mail, Phone, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductChangeDialog from '@/components/autumn/product-change-dialog';
import { useProfile, useUpdateProfile, useSettings, useUpdateSettings } from '@/hooks/useProfile';

// Separate component that uses Autumn hooks
function DashboardContent({ session }: { session: any }) {
  const { customer, attach } = useCustomer();
  const { products } = usePricingTable();
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  
  // Profile and settings hooks
  const { data: profileData } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  
  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    bio: '',
    phone: '',
  });

  useEffect(() => {
    if (profileData?.profile) {
      setProfileForm({
        displayName: profileData.profile.displayName || '',
        bio: profileData.profile.bio || '',
        phone: profileData.profile.phone || '',
      });
    }
  }, [profileData]);

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync(profileForm);
    setIsEditingProfile(false);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    if (profileData?.profile) {
      setProfileForm({
        displayName: profileData.profile.displayName || '',
        bio: profileData.profile.bio || '',
        phone: profileData.profile.phone || '',
      });
    }
  };

  const handleSettingToggle = async (key: string, value: boolean) => {
    await updateSettings.mutateAsync({ [key]: value });
  };

  // Get current user's products and features
  const userProducts = customer?.products || [];
  const userFeatures = customer?.features || {};
  
  // Find the actual active product (not scheduled)
  const activeProduct = userProducts.find(p => 
    p.status === 'active' || p.status === 'trialing' || p.status === 'past_due'
  );
  const scheduledProduct = userProducts.find(p => 
    p.status === 'scheduled' || (p.started_at && new Date(p.started_at) > new Date())
  );

  const handleUpgrade = async (productId: string) => {
    try {
      setLoadingProductId(productId);
      await attach({
        productId,
        dialog: ProductChangeDialog,
        returnUrl: window.location.origin + '/dashboard',
        successUrl: window.location.origin + '/dashboard',
        cancelUrl: window.location.origin + '/dashboard',
      });
    } finally {
      setLoadingProductId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">{t('dashboard.title')}</h1>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('dashboard.profileInformation')}</h2>
            {!isEditingProfile ? (
              <Button
                onClick={() => setIsEditingProfile(true)}
                size="sm"
                className="bg-black text-white hover:bg-gray-800"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t('dashboard.editProfile')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  size="sm"
                  variant="default"
                  disabled={updateProfile.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {t('dashboard.save')}
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="sm"
                  variant="outline"
                  disabled={updateProfile.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('dashboard.cancel')}
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline-block h-4 w-4 mr-1" />
                {t('dashboard.email')}
              </label>
              <p className="text-gray-900">{session.user?.email}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline-block h-4 w-4 mr-1" />
                {t('dashboard.displayName')}
              </label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('dashboard.enterDisplayName')}
                />
              ) : (
                <p className="text-gray-900">
                  {profileData?.profile?.displayName || t('dashboard.notSet')}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline-block h-4 w-4 mr-1" />
                {t('dashboard.phone')}
              </label>
              {isEditingProfile ? (
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('dashboard.enterPhone')}
                />
              ) : (
                <p className="text-gray-900">
                  {profileData?.profile?.phone || t('dashboard.notSet')}
                </p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('dashboard.bio')}
              </label>
              {isEditingProfile ? (
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={t('dashboard.tellAboutYourself')}
                />
              ) : (
                <p className="text-gray-900">
                  {profileData?.profile?.bio || t('dashboard.notSet')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.settings')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('dashboard.emailNotifications')}</p>
                <p className="text-sm text-gray-600">{t('dashboard.emailNotificationsDesc')}</p>
              </div>
              <button
                onClick={() => handleSettingToggle('emailNotifications', !settings?.emailNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.emailNotifications ? 'bg-orange-500' : 'bg-gray-200'
                }`}
                disabled={updateSettings.isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('dashboard.marketingEmails')}</p>
                <p className="text-sm text-gray-600">{t('dashboard.marketingEmailsDesc')}</p>
              </div>
              <button
                onClick={() => handleSettingToggle('marketingEmails', !settings?.marketingEmails)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.marketingEmails ? 'bg-orange-500' : 'bg-gray-200'
                }`}
                disabled={updateSettings.isPending}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.marketingEmails ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.accountInformation')}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.email')}</p>
              <p className="font-medium">{session.user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('dashboard.currentPlan')}</p>
              <p className="font-medium flex items-center">
                {activeProduct ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    {activeProduct.name || activeProduct.id}
                    {scheduledProduct && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({t('dashboard.changingTo')} {scheduledProduct.name || scheduledProduct.id} {t('dashboard.on')} {new Date(scheduledProduct.started_at || scheduledProduct.current_period_end).toLocaleDateString()})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-500 mr-1" />
                    {t('dashboard.freePlan')}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.usageStatistics')}</h2>
          {Object.keys(userFeatures).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(userFeatures).map(([featureId, feature]) => (
                <div key={featureId}>
                  <div className="mb-4">
                    <h3 className="font-medium mb-2 capitalize">{featureId.replace(/_/g, ' ')}</h3>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('dashboard.used')}</span>
                      <span>{feature.usage || 0} / {feature.included_usage || feature.balance + (feature.usage || 0)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(((feature.usage || 0) / (feature.included_usage || feature.balance + (feature.usage || 0) || 1)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  {feature.next_reset_at && (
                    <p className="text-sm text-gray-600">
                      {t('dashboard.resetsOn')}: {new Date(feature.next_reset_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">{t('dashboard.noUsageData')}</p>
          )}
        </div>

        {/* Available Plans */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.availablePlans')}</h2>
          {!products ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const isCurrentPlan = activeProduct?.id === product.id;
                const isScheduledPlan = scheduledProduct?.id === product.id;
                const features = product.properties?.is_free ? product.items : product.items?.slice(1) || [];
                
                return (
                  <div key={product.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">
                          {product.display?.name || product.name}
                          {isCurrentPlan && (
                            <span className="ml-2 text-sm text-green-600">{t('dashboard.currentPlanLabel')}</span>
                          )}
                          {isScheduledPlan && (
                            <span className="ml-2 text-sm text-orange-600">{t('dashboard.scheduledLabel')}</span>
                          )}
                        </h3>
                        {product.display?.description && (
                          <p className="text-sm text-gray-600 mt-1">{product.display.description}</p>
                        )}
                        <ul className="mt-3 space-y-1">
                          {features.slice(0, 3).map((item, index) => (
                            <li key={index} className="flex items-start text-sm">
                              {isCurrentPlan ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Lock className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                              )}
                              <span className={!isCurrentPlan ? 'text-gray-500' : ''}>
                                {item.display?.primary_text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!isCurrentPlan && !isScheduledPlan && (
                        <Button 
                          onClick={() => handleUpgrade(product.id)} 
                          size="sm"
                          variant="outline"
                          disabled={loadingProductId !== null}
                        >
                          {loadingProductId === product.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {t('dashboard.loading')}
                            </>
                          ) : (
                            product.properties?.is_free ? t('dashboard.downgrade') : t('dashboard.upgrade')
                          )}
                        </Button>
                      )}
                      {isScheduledPlan && (
                        <span className="text-sm text-gray-500">
                          {t('dashboard.starts')} {new Date(scheduledProduct.started_at || scheduledProduct.current_period_end).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    if (!isPending && !session) {
      router.push(`/${locale}/login`);
    }
  }, [session, isPending, router, locale]);

  if (isPending || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  // Only render DashboardContent when we have a session and AutumnProvider is available
  return <DashboardContent session={session} />;
}