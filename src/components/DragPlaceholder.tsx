import {cn} from '@enonic/ui';

import type {DragPlaceholderVariant} from '../state';
import type {JSX} from 'preact';

import {useI18n} from '../i18n';

export type DragPlaceholderProps = {
  itemLabel: string;
  dropAllowed: boolean;
  message?: string;
  variant?: DragPlaceholderVariant;
  className?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({
  dropAllowed,
  message,
  variant = 'slot',
  className,
}: DragPlaceholderProps): JSX.Element => {
  const t = useI18n();
  const text = dropAllowed ? t('field.drag.release') : (message ?? t('field.drag.notAllowed'));

  const dashClasses = cn(
    'pe-dash flex h-full items-center justify-center bg-surface-info/20 px-4 py-2.5 text-center',
    variant === 'region' && 'min-h-25',
    dropAllowed ? 'pe-dash-info text-subtle italic' : 'pe-dash-error text-error',
  );

  return (
    <div
      data-component={DRAG_PLACEHOLDER_NAME}
      className={cn(
        'pe-shell overflow-hidden bg-surface-neutral',
        // ? Region rejection: the overlay's fixed height matches the region,
        // ? which can be shorter than the dashed box (min-h-25 + p-2.5 = 120px).
        // ? min-h-30 floors the shell at 120px so the rejection message is
        // ? never cropped; the shell extends past the overlay when needed.
        variant === 'region' && 'min-h-30',
        className,
      )}
    >
      <div className='h-full p-2.5'>
        <div className={dashClasses}>{text}</div>
      </div>
    </div>
  );
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
