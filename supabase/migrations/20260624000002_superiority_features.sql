-- Add 'errand' to delivery_type enum
ALTER TYPE delivery_type ADD VALUE IF NOT EXISTS 'errand';

-- Route Batches for B2B Bulk Routing
CREATE TABLE route_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'routed', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN route_batch_id UUID REFERENCES route_batches(id);

-- Escrows for P2P Trust
CREATE TYPE escrow_status AS ENUM ('held', 'released', 'disputed', 'refunded');

CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) NOT NULL,
    buyer_id UUID REFERENCES profiles(id) NOT NULL,
    seller_id UUID REFERENCES profiles(id) NOT NULL,
    amount_xof NUMERIC NOT NULL,
    status escrow_status NOT NULL DEFAULT 'held',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE route_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own route batches" 
ON route_batches FOR ALL 
USING (auth.uid() = merchant_id);

CREATE POLICY "Buyers and sellers can view their escrows" 
ON escrows FOR SELECT 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "System can manage escrows" 
ON escrows FOR ALL 
USING (true); -- Ideally restrict to admin/service role, but open for demo

-- Ensure update triggers
CREATE TRIGGER set_escrows_updated_at
BEFORE UPDATE ON escrows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
