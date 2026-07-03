import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productsPath = path.resolve(__dirname, '../src/data/products.json');
if (!fs.existsSync(productsPath)) {
  console.error(`[Error] products.json not found at ${productsPath}`);
  process.exit(1);
}

const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Curated Unsplash images for each of the 15 categories
const categoryImages = {
  "Website Templates": [
    "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=800&q=80"
  ],
  "UI Kits": [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1541462608143-67571c6738dd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?auto=format&fit=crop&w=800&q=80"
  ],
  "Mobile App Designs": [
    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=800&q=80"
  ],
  "Figma Resources": [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1634973357973-f2ed255753e1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618005198143-e5283b519a7f?auto=format&fit=crop&w=800&q=80"
  ],
  "React Templates": [
    "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=800&q=80"
  ],
  "AI Tools": [
    "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80"
  ],
  "AI Prompt Packs": [
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1684369175833-3d0774a385f0?auto=format&fit=crop&w=800&q=80"
  ],
  "Resume Templates": [
    "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80"
  ],
  "Business Templates": [
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
  ],
  "E-books": [
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=800&q=80"
  ],
  "Notion Templates": [
    "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80"
  ],
  "Social Media Kits": [
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1611224885990-ab7363d1f2a9?auto=format&fit=crop&w=800&q=80"
  ],
  "Design Assets": [
    "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
  ],
  "Icons & Illustrations": [
    "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=800&q=80"
  ],
  "Productivity Tools": [
    "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80"
  ]
};

const updatedProducts = products.map(product => {
  const id = Number(product.id);
  let category = "Design Assets";

  // Re-map category based on ID ranges & original categories
  if (id >= 1 && id <= 5) {
    if (id === 1 || id === 5) {
      category = "UI Kits";
    } else {
      category = "Mobile App Designs";
    }
  } else if (id >= 6 && id <= 10) {
    category = "Website Templates";
  } else if (id >= 11 && id <= 20) {
    category = "React Templates";
  } else if (id >= 21 && id <= 25) {
    category = "AI Prompt Packs";
  } else if (id >= 26 && id <= 35) {
    if (id === 27 || id === 31) {
      category = "Business Templates";
    } else if (id === 33) {
      category = "Design Assets";
    } else {
      category = "Social Media Kits";
    }
  } else if (id >= 36 && id <= 45) {
    if (id === 39 || id === 44) {
      category = "Business Templates";
    } else {
      category = "Notion Templates";
    }
  } else if (id >= 46 && id <= 50) {
    category = "Resume Templates";
  } else if (id >= 51 && id <= 60) {
    category = "E-books";
  } else if (id >= 61 && id <= 70) {
    if (id === 61 || id === 62) {
      category = "React Templates";
    } else if (id === 63) {
      category = "Figma Resources";
    } else if (id === 64) {
      category = "Productivity Tools";
    } else if (id === 65) {
      category = "Business Templates";
    } else {
      // Map IDs 66-70 to AI Tools
      category = "AI Tools";
    }
  } else if (id >= 71 && id <= 75) {
    category = "Icons & Illustrations";
  } else if (id >= 76 && id <= 80) {
    category = "Design Assets";
  } else if (id >= 81 && id <= 85) {
    category = "Design Assets";
  } else if (id >= 86 && id <= 90) {
    category = "Design Assets";
  } else if (id >= 91 && id <= 100) {
    category = "Design Assets";
  }

  // Assign Unsplash image preview matching category
  const images = categoryImages[category] || categoryImages["Design Assets"];
  const imageIndex = id % images.length;
  const imageUrl = images[imageIndex];

  // Adjust titles for AI Tools
  let title = product.title;
  let description = product.description;
  if (category === "AI Tools") {
    const aiTitles = {
      66: "AI-Powered Code Assistant Node",
      67: "Midjourney Design Automation Pipeline",
      68: "ChatGPT Editorial Copywriter Pack",
      69: "Stable Diffusion Conceptual Art Presets",
      70: "AI Copilot Terminal Orchestration Node"
    };
    const aiDescs = {
      66: "Automate syntax analysis and Spring transitions in React layouts.",
      67: "Trigger production-ready branding imagery generation loops.",
      68: "Predefined prompt layouts optimized for marketing agencies.",
      69: "Ultra-high quality design checkpoints for luxury style renders.",
      70: "Node script backend framework executing local LLM automation."
    };
    if (aiTitles[id]) title = aiTitles[id];
    if (aiDescs[id]) description = aiDescs[id];
  }

  // Adjust details for Productivity Tools
  if (id === 59) {
    category = "Productivity Tools";
  }

  // Generate realistic ratings & reviews
  const rating = Number((4.5 + Math.random() * 0.5).toFixed(1));
  const downloads = Math.floor(Math.random() * 4500) + 250;
  const reviews = Math.floor(downloads * 0.08) + 8;

  // Add realistic tags based on category
  const tagsList = {
    "Website Templates": ["web", "landing", "saas", "responsive", "html", "css"],
    "UI Kits": ["ui kit", "figma", "dashboard", "components", "design-system"],
    "Mobile App Designs": ["mobile", "ios", "android", "app", "figma", "react-native"],
    "Figma Resources": ["figma", "design", "assets", "vector", "styleguide"],
    "React Templates": ["react", "vite", "tailwind", "nextjs", "dashboard", "frontend"],
    "AI Tools": ["ai", "copilot", "prompt", "llm", "automation", "python"],
    "AI Prompt Packs": ["ai", "midjourney", "chatgpt", "prompts", "generative"],
    "Resume Templates": ["resume", "cv", "career", "ats-friendly", "word", "pdf"],
    "Business Templates": ["business", "pitchdeck", "startup", "presentation", "sheets"],
    "E-books": ["ebook", "guide", "tutorial", "pdf", "learn", "book"],
    "Notion Templates": ["notion", "workspace", "productivity", "tracker", "dashboard"],
    "Social Media Kits": ["social", "instagram", "canva", "carousel", "branding"],
    "Design Assets": ["assets", "3d", "vector", "gradient", "video", "fonts"],
    "Icons & Illustrations": ["icons", "illustrations", "svg", "vector", "assets"],
    "Productivity Tools": ["productivity", "tools", "tasks", "calendar", "pomo"]
  };
  const tags = tagsList[category] || ["digital", "assets"];

  // Add highlights
  const highlights = [
    "Fully customizable layers & styles",
    "Commercial usage license included",
    "Lifetime updates & version revisions",
    "High-fidelity responsive components"
  ];

  // Set flags
  const featured = id % 12 === 0 || id === 1 || id === 11 || id === 36;
  const trending = id % 8 === 0 || id === 2 || id === 21 || id === 71;
  const newArrival = id % 10 === 0 || id === 3 || id === 46;

  // Generate unique product highlights
  return {
    ...product,
    title,
    description,
    category,
    price: Number(product.price) || 29.99,
    rating,
    downloads,
    reviews,
    thumbnail: imageUrl,
    preview: imageUrl,
    featured,
    trending,
    newArrival,
    tags,
    highlights,
    badge: featured ? 'Featured' : trending ? 'Trending' : newArrival ? 'New' : ''
  };
});

fs.writeFileSync(productsPath, JSON.stringify(updatedProducts, null, 2), 'utf8');
console.log(`[Success] Processed and reformatted ${updatedProducts.length} products in products.json.`);
