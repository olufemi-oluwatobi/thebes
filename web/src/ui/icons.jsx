// One icon set (Lucide), one weight. Size and stroke are set here so every screen matches.
import { ChevronLeft, ChevronRight, Plus, X, Check, SendHorizontal, Forward, ArrowUpRight, Play as PlayI, Upload, Info as InfoI, ShieldCheck,
  Compass, MessageCircle, UserRound, MoreHorizontal, Tag as TagI, Package, AtSign, Search as SearchI, Bell as BellI, ArrowLeftRight, ImagePlus,
  Globe as GlobeI, Wallet as WalletI, Clock as ClockI, SquarePlus, LogOut } from 'lucide-react';
const w = (C, extra = {}) => (p) => <C size={22} strokeWidth={1.75} aria-hidden {...extra} {...p} />;
export const Back = w(ChevronLeft);
export const Chev = w(ChevronRight);
export const Plus_ = w(Plus);
export { Plus_ as Plus };
export const X_ = w(X);
export { X_ as X };
export const Check_ = w(Check, { strokeWidth: 2.25 });
export { Check_ as Check };
export const Send = w(SendHorizontal);
export const Share = w(Forward);
export const Visit = w(ArrowUpRight, { strokeWidth: 2 });
export const Play = w(PlayI, { fill: 'currentColor' });
export const Up = w(Upload);
export const Info = w(InfoI);
export const Shield = w(ShieldCheck);
export const Feed = w(Compass);
export const Create = w(SquarePlus);
export const Chat = w(MessageCircle);
export const Me = w(UserRound);
export const Dots = w(MoreHorizontal);
export const Tag = w(TagI);
export const Box = w(Package);
export const At = w(AtSign);
export const Search = w(SearchI);
export const Bell = w(BellI);
export const Swap = w(ArrowLeftRight);
export const Image = w(ImagePlus);
export const Globe = w(GlobeI);
export const Wallet = w(WalletI);
export const Clock = w(ClockI);
export const Out = w(LogOut);
