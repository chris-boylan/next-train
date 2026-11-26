import { createContext, useContext } from 'react';

/** Opens the help page from anywhere (the options cog sits on every screen). */
export const HelpContext = createContext<() => void>(() => {});
export const useOpenHelp = () => useContext(HelpContext);
