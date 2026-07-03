import React from 'react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import About from '../support/About';

export default function AboutPage() {
  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '80px' }}>
        <About />
      </div>
      <Footer />
    </div>
  );
}
