import {cn} from '@enonic/ui';

import type {JSX} from 'preact';

import {useI18n} from '../i18n';

export type DragPlaceholderProps = {
  itemLabel: string;
  dropAllowed: boolean;
  message?: string;
  className?: string;
};

const DRAG_PLACEHOLDER_NAME = 'DragPlaceholder';

export const DragPlaceholder = ({dropAllowed, message, className}: DragPlaceholderProps): JSX.Element => {
  const t = useI18n();
  const text = dropAllowed ? t('field.drag.release') : (message ?? t('field.drag.notAllowed'));

  return (
    <div
      data-component={DRAG_PLACEHOLDER_NAME}
      className={cn('pe-shell overflow-hidden bg-surface-neutral', className)}
    >
      <div className='h-full p-2.5'>
        <div
          className={cn(
            'pe-dash flex min-h-25 items-center justify-center bg-surface-info/20 px-4 py-2.5 text-center',
            dropAllowed ? 'pe-dash-info text-subtle italic' : 'pe-dash-error text-error',
          )}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

DragPlaceholder.displayName = DRAG_PLACEHOLDER_NAME;
