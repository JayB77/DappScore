// Renamed to /claim — this redirect keeps old bookmarks working.
import { redirect } from 'next/navigation';
export default function AirdropRedirect() { redirect('/claim'); }
