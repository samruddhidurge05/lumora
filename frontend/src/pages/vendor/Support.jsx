import React from 'react';
import VendorLayout from './VendorLayout';
import SupportCenter from '../customer/SupportCenter';

export default function VendorSupport() {
  return (
    <VendorLayout
      activePage="support"
      title="Vendor Support Center"
      subtitle="Access platform support, submit help desk tickets, and browse vendor documentation"
    >
      <SupportCenter />
    </VendorLayout>
  );
}
