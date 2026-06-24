const ITEM_API_URL = 'http://localhost:8001';
const COLLECTION_API_URL = 'http://localhost:8002';

export interface Item {
  idGames?: number;
  name: string;
  img?: string;
  totalHours?: number;
  idLibrary?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
}

interface ItemResponse {
  items: RawItem[];
}

interface RawItem {
  idGames?: number;
  name: string;
  img?: string;
  totalHours?: number | string;
  idLibrary?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
}

const normalizeImagePath = (imagePath: string | undefined): string | undefined => {
  if (!imagePath) return undefined;
  return imagePath;
};

const normalizeItem = (item: RawItem): Item => ({
  ...item,
  img: normalizeImagePath(item.img),
  totalHours: typeof item.totalHours === 'number' ? item.totalHours : (item.totalHours ? parseFloat(item.totalHours) : undefined),
  isFavorite: Boolean(item.isFavorite),
  isPinned: Boolean(item.isPinned),
});

export const itemCollectionService = {
  getAllItems: async (token: string): Promise<Item[]> => {
    const response = await fetch(`${ITEM_API_URL}/items/itemsList`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error fetching items');
    }

    const data = (await response.json()) as ItemResponse;
    const items = data.items || [];
    return items.map(normalizeItem);
  },

  searchItemsNotInCollection: async (
    token: string,
    userId: string,
    searchTerm: string
  ): Promise<Item[]> => {
    const response = await fetch(`${COLLECTION_API_URL}/collection/searchItemsNotInCollection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        idUsers: parseInt(userId),
        searchTerm: searchTerm || '%',
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error searching items');
    }

    const data = (await response.json()) as ItemResponse;
    const items = data.items || [];
    return items.map(normalizeItem);
  },

  createItem: async (token: string, name: string, image?: File): Promise<Item> => {
    const formData = new FormData();
    formData.append('name', name);
    if (image) {
      formData.append('image', image);
    }

    const response = await fetch(`${ITEM_API_URL}/items/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error creating item');
    }

    const data = (await response.json()) as { item: RawItem };
    return normalizeItem(data.item);
  },

  addToCollection: async (token: string, userId: string, itemId: number): Promise<void> => {
    const response = await fetch(`${COLLECTION_API_URL}/collection/createCollection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        idUsers: parseInt(userId),
        idGames: itemId,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error adding item to collection');
    }
  },

  getUserCollection: async (token: string, userId: string): Promise<Item[]> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/collectionListByUserId`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          idUsers: parseInt(userId),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.text().catch(() => null)) as string | null;
        console.error(`❌ Collection API Error: ${response.status} ${response.statusText}`, errorData);
        throw new Error(`Error fetching collection: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { collection?: RawItem[]; items?: RawItem[] };
      const items = data.collection || data.items || [];
      return items.map(normalizeItem);
    } catch (error) {
      console.error('🔴 getUserCollection error:', error);
      throw error;
    }
  },

  updateItemFavorite: async (token: string, idLibrary: number, isFavorite: boolean): Promise<void> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/updateCollection`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idLibrary, isFavorite }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message || 'Error updating favorite status');
      }
    } catch (error) {
      console.error('❌ updateItemFavorite error:', error);
      throw error;
    }
  },

  updateItemPinned: async (token: string, idLibrary: number, isPinned: boolean): Promise<void> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/updateCollection`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idLibrary, isPinned }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message || 'Error updating pinned status');
      }
    } catch (error) {
      console.error('❌ updateItemPinned error:', error);
      throw error;
    }
  },

  deleteFromCollection: async (token: string, idLibrary: number): Promise<void> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/deleteCollection`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idLibrary }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message || 'Error deleting item from collection');
      }
    } catch (error) {
      console.error('❌ deleteFromCollection error:', error);
      throw error;
    }
  },

  getFavoriteItems: async (token: string, userId: string): Promise<Item[]> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/favoriteItems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idUsers: parseInt(userId) }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message || 'Error fetching favorite items');
      }

      const data = (await response.json()) as { items?: RawItem[] };
      const items = data.items || [];
      return items.map(normalizeItem);
    } catch (error) {
      console.error('❌ getFavoriteItems error:', error);
      throw error;
    }
  },

  getPinnedItems: async (token: string, userId: string): Promise<Item[]> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/pinnedItems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idUsers: parseInt(userId) }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message || 'Error fetching pinned items');
      }

      const data = (await response.json()) as { items?: RawItem[] };
      const items = data.items || [];
      return items.map(normalizeItem);
    } catch (error) {
      console.error('❌ getPinnedItems error:', error);
      throw error;
    }
  },

  getCollectionByHours: async (token: string, userId: string): Promise<Item[]> => {
    try {
      const response = await fetch(`${COLLECTION_API_URL}/collection/collectionListHourByUserId`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ idUsers: parseInt(userId) }),
      });

      if (!response.ok) {
        const errorData = (await response.text().catch(() => null)) as string | null;
        throw new Error(errorData || 'Error fetching collection by hours');
      }

      const data = (await response.json()) as { collection?: RawItem[]; items?: RawItem[] };
      const items = data.collection || data.items || [];
      return items.map(normalizeItem);
    } catch (error) {
      console.error('❌ getCollectionByHours error:', error);
      throw error;
    }
  },
};
