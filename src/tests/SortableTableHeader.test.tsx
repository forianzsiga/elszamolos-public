import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { SortableTableHeader } from '../components/SortableTableHeader';
import { LanguageProvider } from '../context/LanguageContext';

describe('SortableTableHeader', () => {
  test('label click does not trigger sort; icon click does', () => {
    const onSort = vi.fn();
    const { getByText, getByRole } = render(
      <LanguageProvider>
        <div style={{ width: 200 }}>
          <SortableTableHeader
            label="Name"
            field="name"
            width={200}
            minWidth={50}
            onResize={() => {}}
            sortConfig={null}
            onSort={onSort}
            sortable={true}
            rows={[]}
          />
        </div>
      </LanguageProvider>
    );

    const label = getByText('Name');
    fireEvent.click(label);
    expect(onSort).not.toHaveBeenCalled();

    const button = getByRole('button');
    fireEvent.click(button);
    expect(onSort).toHaveBeenCalledWith('name');
  });
});
