import React from 'react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import Contact from '../support/Contact';

export default function ContactPage() {
  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '80px' }}>
        <Contact />
      </div>
      <Footer />
    </div>
  );
}
