import type { Meta, StoryObj } from "@storybook/react";
import { ListPositionDialog } from "./ListPositionDialog";
import type { InvestorPosition } from "@/types/invoice";

const mockPosition: InvestorPosition = {
  positionId: "pos-001",
  invoiceId: "inv-001",
  ownerAddress: "GOWNER123",
  amountInvested: 5000,
  ownershipFraction: 0.1,
  purchaseDate: "2024-02-01T00:00:00Z",
  status: "active",
  invoice: {
    id: "inv-001",
    tokenId: "tok-001",
    contractAddress: "GABC1234CONTRACTADDRESS",
    ipfsCid: "QmExampleCid",
    metadata: {
      invoiceNumber: "INV-2024-001",
      issuerName: "Acme Corp Ltd",
      issuerAddress: "GISSUER1234",
      debtorName: "Global Buyers Inc",
      debtorAddress: "123 Business Way, New York, NY 10001",
      amount: 50000,
      currency: "USDC",
      issueDate: "2024-01-15T00:00:00Z",
      dueDate: "2024-07-15T00:00:00Z",
      description: "Technology services invoice Q1 2024",
      jurisdiction: "US",
      category: "technology",
      documentHash: "QmDocHash",
      documentUrl: "https://ipfs.io/ipfs/QmDocHash",
    },
    terms: {
      discountRate: 0.06,
      apr: 14.5,
      financingAmount: 47000,
      minInvestment: 1000,
      maxInvestment: 10000,
      tenor: 180,
      repaymentDate: "2024-07-15T00:00:00Z",
    },
    funding: {
      totalRaised: 47000,
      targetAmount: 47000,
      fundingProgress: 1.0,
      investorCount: 4,
      remainingCapacity: 0,
    },
    riskTier: "A",
    riskScore: 82,
    debtorPrivacy: "full",
    status: "fully_funded",
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-01-16T00:00:00Z",
    ownerAddress: "GOWNER1234",
  },
};

const meta: Meta<typeof ListPositionDialog> = {
  title: "Invoice/ListPositionDialog",
  component: ListPositionDialog,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ListPositionDialog>;

export const Default: Story = {
  args: {
    open: true,
    position: mockPosition,
    onOpenChange: () => {},
    onSubmit: () => {},
  },
};
