import { useCallback, useEffect } from 'react';
import { useUI, type SheetEntry } from '../store/ui';
import { Sheet, type Snap } from './Sheet';
import { AddSheet } from './sheets/AddSheet';
import { CitySheet, CitySheetHeader } from './sheets/CitySheet';
import { CountrySheet, CountrySheetHeader } from './sheets/CountrySheet';
import { IdeaSheet, IdeaSheetHeader, useIdeaEditor } from './sheets/IdeaSheet';
import { SearchSheet } from './sheets/SearchSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { SheetHeader } from './ui';

export function SheetHost() {
  const sheets = useUI((s) => s.sheets);
  const setCover = useUI((s) => s.setCover);
  useEffect(() => {
    if (sheets.length === 0) setCover(0, false);
  }, [sheets.length, setCover]);
  return (
    <>
      {sheets.map((entry, i) => (
        <HostedSheet key={entry.key} entry={entry} depth={i} isTop={i === sheets.length - 1} />
      ))}
    </>
  );
}

function HostedSheet({ entry, depth, isTop }: { entry: SheetEntry; depth: number; isTop: boolean }) {
  const tab = useUI((s) => s.tab);
  const closeSheet = useUI((s) => s.closeSheet);
  const setCover = useUI((s) => s.setCover);
  const onClosed = useCallback(() => closeSheet(entry.key), [closeSheet, entry.key]);
  const onCover = useCallback((px: number, full: boolean) => setCover(px, full), [setCover]);
  const spec = entry.spec;

  const common = { depth, isTop, onClosed, onCover };

  switch (spec.kind) {
    case 'country':
    case 'city': {
      const onGlobe = tab === 'globe';
      const snaps: Snap[] = onGlobe ? ['half', 'full'] : ['full'];
      return (
        <Sheet
          {...common}
          label={spec.kind === 'country' ? 'Land' : 'Stadt'}
          snaps={snaps}
          initial={onGlobe ? 'half' : 'full'}
          modal={!onGlobe}
          header={spec.kind === 'country' ? <CountrySheetHeader code={spec.code} /> : <CitySheetHeader id={spec.id} />}
        >
          {spec.kind === 'country' ? <CountrySheet key={spec.code} code={spec.code} /> : <CitySheet key={spec.id} id={spec.id} />}
        </Sheet>
      );
    }
    case 'idea':
      return <IdeaHostedSheet common={common} id={spec.id} prefill={spec.prefill} />;
    case 'add':
      return (
        <Sheet {...common} label="Hinzufügen" snaps={['half']} initial="half" modal halfRatio={0.6}>
          <AddSheet />
        </Sheet>
      );
    case 'search':
      return (
        <Sheet {...common} label="Suche" snaps={['full']} initial="full" modal>
          <SearchSheet mode={spec.mode} countryCode={spec.countryCode} status={spec.status} />
        </Sheet>
      );
    case 'settings':
      return (
        <Sheet {...common} label="Einstellungen" snaps={['full']} initial="full" modal header={<SheetHeader title="Einstellungen" />}>
          <SettingsSheet />
        </Sheet>
      );
  }
}

function IdeaHostedSheet({
  common,
  id,
  prefill,
}: {
  common: { depth: number; isTop: boolean; onClosed(): void; onCover(px: number, full: boolean): void };
  id?: string;
  prefill?: Parameters<typeof useIdeaEditor>[0]['prefill'];
}) {
  const editor = useIdeaEditor({ id, prefill });
  return (
    <Sheet {...common} label="Idee" snaps={['full']} initial="full" modal header={<IdeaSheetHeader id={id} editor={editor} />}>
      <IdeaSheet editor={editor} id={id} />
    </Sheet>
  );
}
