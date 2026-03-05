const GAME_API_URL = 'http://localhost:8001';
const LIBRARY_API_URL = 'http://localhost:8002';

interface Game {
  idGames?: number;
  name: string;
  img?: string;
}

interface GameResponse {
  games: Game[];
}

interface LibraryCreateResponse {
  message: string;
}

// Images are mounted directly in /public/gameImage, accessible locally
const normalizeImagePath = (imagePath: string | undefined): string | undefined => {
  if (!imagePath) return undefined;
  
  // Images are already in the correct format (/gameImage/filename.png)
  // Just return as-is since they're mounted in the frontend's public directory
  return imagePath;
};

export const gameLibraryService = {
  // Get all games
  getAllGames: async (token: string): Promise<Game[]> => {
    const response = await fetch(`${GAME_API_URL}/games/gamesList`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error fetching games');
    }

    const data = (await response.json()) as GameResponse;
    const games = data.games || [];
    // Normalize image paths for all games
    return games.map(game => ({
      ...game,
      img: normalizeImagePath(game.img)
    }));
  },

  // Search games NOT in user's library
  searchGamesNotInLibrary: async (
    token: string,
    userId: string,
    searchTerm: string
  ): Promise<Game[]> => {
    const response = await fetch(`${LIBRARY_API_URL}/library/searchGamesNotInLibrary`, {
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
      throw new Error(errorData?.message || 'Error searching games');
    }

    const data = (await response.json()) as GameResponse;
    const games = data.games || [];
    console.log('📦 Games loaded:', games.length);
    games.forEach((game) => {
      const normalizedPath = normalizeImagePath(game.img);
      console.log(`  - ${game.name}: ${normalizedPath}`);
    });
    // Normalize image paths for all games
    return games.map(game => ({
      ...game,
      img: normalizeImagePath(game.img)
    }));
  },

  // Create a new game
  createGame: async (token: string, name: string, image?: File): Promise<Game> => {
    const formData = new FormData();
    formData.append('name', name);
    if (image) {
      formData.append('image', image);
      console.log('📤 Sending form data with image:', image.name);
    } else {
      console.log('📤 Sending form data without image (using default)');
    }

    console.log('🔗 POST to:', `${GAME_API_URL}/games/create`);

    const response = await fetch(`${GAME_API_URL}/games/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error creating game');
    }

    const data = (await response.json()) as { game: Game };
    console.log('✅ Game created response:', data.game);
    console.log('🖼️ Image path in response:', data.game.img);
    return {
      ...data.game,
      img: normalizeImagePath(data.game.img)
    };
  },

  // Add game to user's library
  addToLibrary: async (token: string, userId: string, gameId: number): Promise<void> => {
    const response = await fetch(`${LIBRARY_API_URL}/library/createLibrary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        idUsers: parseInt(userId),
        idGames: gameId,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error adding game to library');
    }
  },

  // Get user's library
  getUserLibrary: async (token: string, userId: string): Promise<Game[]> => {
    const response = await fetch(`${LIBRARY_API_URL}/library/libraryListByUserId`, {
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
      throw new Error('Error fetching library');
    }

    const data = (await response.json()) as { library: Game[] };
    const games = data.library || [];
    // Normalize image paths for all games
    return games.map(game => ({
      ...game,
      img: normalizeImagePath(game.img)
    }));
  },
};
