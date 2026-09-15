export function saveData(key, data) {
    try {
        if (!key || typeof key !== 'string') {
            throw new Error('Storage key is invalid');
        }
        localStorage.setItem(`lifeos_${key}`, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage', e);
    }
}

export function loadData(key, fallback = []) {
    try {
        if (!key || typeof key !== 'string') {
            return fallback;
        }
        const item = localStorage.getItem(`lifeos_${key}`);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        return parsed ?? fallback;
    } catch (e) {
        console.error('Error loading from localStorage', e);
        return fallback;
    }
}