// Utility to fetch games and map appid to name in Decky plugins

export type GameEntry = { appid: number; name: string };

// Fetch installed games using SteamClient.InstallFolder.GetInstallFolders
export async function getInstalledGames(): Promise<GameEntry[]> {
  if (
    !window.SteamClient ||
    !window.SteamClient.InstallFolder ||
    !window.SteamClient.InstallFolder.GetInstallFolders
  ) {
    return [];
  }
  const folders = await window.SteamClient.InstallFolder.GetInstallFolders();
  const games: GameEntry[] = [];
  folders.forEach((folder: any) => {
    folder.vecApps.forEach((app: any) => {
      games.push({
        appid: app.nAppID,
        name: app.strAppName,
      });
    });
  });
  return games;
}

// Fetch all games if collectionStore is available
export function getAllGames(): GameEntry[] {
  const collectionStore = (window as any).collectionStore;
  if (
    !collectionStore ||
    !collectionStore.allGamesCollection ||
    !collectionStore.allGamesCollection.allApps
  ) {
    return [];
  }
  return collectionStore.allGamesCollection.allApps.map((app: any) => ({
    appid: app.appid,
    name: app.display_name,
  }));
}

// Lookup game name by AppID
export function getGameNameByAppId(appid: number, games: GameEntry[]): string {
  const match = games.find((game) => game.appid === appid);
  return match ? match.name : `AppID: ${appid}`;
}