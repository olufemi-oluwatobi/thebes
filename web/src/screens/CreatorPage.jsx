import { Page, Empty, Ic } from '../ui/index.jsx';
import { CreatorView, useCreator } from '../ui/creator.jsx';

/* #creator/<marketer id>: a creator's public profile */
export default function CreatorPage({ id }) {
  const { d, err } = useCreator(id);
  return (
    <Page crumb="Creator" onBack={() => history.back()}>
      <div className="mx-auto w-full max-w-2xl">
        {err ? <Empty icon={<Ic.Me />} title="Creator not found" text="This profile is no longer available." />
          : d ? <CreatorView d={d} /> : <div className="grid h-40 place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>}
      </div>
    </Page>
  );
}
