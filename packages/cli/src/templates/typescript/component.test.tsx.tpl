import { render, screen } from '@testing-library/react';
import { {{componentName}} } from './{{componentName}}';

describe('{{componentName}}', () => {
  it('renders successfully', () => {
    render(<{{componentName}} {{testProps}}/>);
    expect(screen.getByText('{{componentName}}')).toBeInTheDocument();
  });
});
