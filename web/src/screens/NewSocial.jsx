import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { PLATFORMS } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Input, Field, Pills } from '../ui/index.jsx';
import { useGate, takeDraft } from '../ui/wizard.jsx';

export default function NewSocial() {
  const { a } = useStore(), gate = useGate();
  const [soc, setSoc] = useState(() => takeDraft()?.soc || { platform: 'instagram', handle: '', followers: '' }), [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const ok = await a.addSocial(soc); setBusy(false); if (ok) go('me'); };
  return (
    <Page crumb="Create" onBack={() => go('plus')} width="narrow" barDesktop bar={<><Button tone="secondary" onClick={() => go('plus')}>Cancel</Button><span className="flex-1" /><Button disabled={busy || !soc.handle.trim()} onClick={() => { if (gate('marketer', save, async () => ({ soc }))) save(); }}>{busy ? 'Saving…' : 'Submit for review'}</Button></>}>
      <PageTitle h="Add a social" p="An admin checks each account before it counts toward listing requirements." />
      <Card><div className="flex flex-col gap-5"><Field label="Platform"><Pills value={soc.platform} onChange={v => setSoc({ ...soc, platform: v })} items={PLATFORMS} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Handle"><Input pre="@" placeholder="yourhandle" value={soc.handle} onChange={e => setSoc({ ...soc, handle: e.target.value })} /></Field><Field label="Followers"><Input type="number" min="0" placeholder="e.g. 4200" value={soc.followers} onChange={e => setSoc({ ...soc, followers: e.target.value })} /></Field></div></div></Card>
    </Page>
  );
}
