import { findStationByCode, type LiveTrain } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { Sheet } from './Sheet';

interface Props {
  train: LiveTrain;
  onClose: () => void;
}

/** A live train's details, opened by tapping it on the map. */
export function TrainSheet({ train, onClose }: Props) {
  const { t, stationName } = useI18n();
  const nameOf = (code: string | undefined, fallback: string) => {
    const station = code ? findStationByCode(code) : undefined;
    return station ? stationName(station) : fallback;
  };
  const lateness =
    train.lateMins > 0 ? t.minsLate(train.lateMins) : train.lateMins < 0 ? t.minsEarly(-train.lateMins) : t.onTime;

  return (
    <Sheet title={t.trainTo(nameOf(train.destinationCode, train.destination))} onClose={onClose}>
      <dl className="train-card">
        {train.at && (
          <>
            <dt>{t.standingAt}</dt>
            <dd>
              <Caps text={nameOf(train.at, train.at)} />
            </dd>
          </>
        )}
        <dt>{t.nextStop}</dt>
        <dd>
          <Caps text={nameOf(train.to, train.to)} />
        </dd>
        <dt>{t.trainStatus}</dt>
        <dd className={train.lateMins >= 5 ? 'train-card__late' : undefined}>{lateness}</dd>
        <dt>{t.trainCode}</dt>
        <dd>
          {train.code} · {t.direction[train.direction]}
        </dd>
      </dl>
    </Sheet>
  );
}
