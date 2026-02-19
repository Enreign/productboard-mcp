export interface FeaturePayload {
  name: string;
  description: string;
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
}
