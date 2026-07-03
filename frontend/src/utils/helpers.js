export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const debounce = (fn, delay) => {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};

export const groupBy = (arr, key) =>
  arr.reduce((acc, item) => { (acc[item[key]] = acc[item[key]] || []).push(item); return acc; }, {});

export const sortByDate = (arr, field = 'created_at', desc = true) =>
  [...arr].sort((a, b) => desc
    ? new Date(b[field]) - new Date(a[field])
    : new Date(a[field]) - new Date(b[field]));

export const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};
