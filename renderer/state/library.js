let sequence = 0;

function revokeUrl(url) {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Önizleme adresi serbest bırakılamadı:', error);
    }
  }
}

export class RecordingLibrary {
  constructor({ onChange } = {}) {
    this.items = [];
    this.selectedId = null;
    this.onChange = onChange;
  }

  add(entry) {
    const id = `rec-${Date.now()}-${(sequence += 1)}`;
    const item = {
      id,
      name: entry.name,
      blob: entry.blob,
      url: entry.url,
      mimeType: entry.mimeType,
      extension: entry.extension,
      duration: entry.duration,
      formatLabel: entry.formatLabel,
      createdAt: entry.createdAt || new Date().toISOString(),
      favorite: Boolean(entry.favorite),
      note: entry.note || '',
      size: entry.size || entry.blob?.size || 0
    };

    this.items.unshift(item);
    this.selectedId = id;
    this.emit();
    return item;
  }

  select(id) {
    if (!id) {
      this.selectedId = null;
      this.emit();
      return;
    }
    const exists = this.items.find((item) => item.id === id);
    if (exists) {
      this.selectedId = id;
      this.emit();
    }
  }

  update(id, updates = {}) {
    const target = this.items.find((item) => item.id === id);
    if (!target) {
      return;
    }

    Object.assign(target, updates);
    this.emit();
  }

  toggleFavorite(id) {
    const target = this.items.find((item) => item.id === id);
    if (!target) {
      return;
    }
    target.favorite = !target.favorite;
    this.emit();
  }

  remove(id) {
    if (!id) {
      return;
    }
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }

    const [removed] = this.items.splice(index, 1);
    revokeUrl(removed?.url);

    if (this.selectedId === id) {
      if (this.items[index]) {
        this.selectedId = this.items[index].id;
      } else if (this.items[index - 1]) {
        this.selectedId = this.items[index - 1].id;
      } else {
        this.selectedId = null;
      }
    }

    this.emit();
  }

  removeSelected() {
    if (this.selectedId) {
      this.remove(this.selectedId);
    }
  }

  clear() {
    this.items.forEach((item) => revokeUrl(item.url));
    this.items = [];
    this.selectedId = null;
    this.emit();
  }

  getSelected() {
    return this.items.find((item) => item.id === this.selectedId) || null;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  emit() {
    this.onChange?.({
      items: [...this.items],
      selected: this.getSelected()
    });
  }
}
