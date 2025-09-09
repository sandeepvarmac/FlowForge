import { render, screen } from '@testing-library/react'
import { Nav } from '@/components/Nav'

// Mock next/navigation for usePathname
vi.mock('next/navigation', () => ({
  usePathname: () => '/' // active on dashboard
}))

describe('Nav', () => {
  it('renders all primary links', () => {
    render(<Nav />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Data Catalog')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})

