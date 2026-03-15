import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './dynamo-client';

const TABLE_NAME = process.env.PLATFORM_SETTINGS_TABLE || 'platform_settings';

export interface PlatformSettings {
  id: string;
  email_templates: Record<string, string>;
  categories: string[];
  feature_flags: Record<string, boolean>;
  updated_at: string;
}

export async function get(): Promise<PlatformSettings | null> {
  const result = await getDocClient().send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { id: 'default' },
  }));
  return (result.Item as PlatformSettings) || null;
}

export async function update(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await get();
  const updated: PlatformSettings = {
    id: 'default',
    email_templates: settings.email_templates ?? current?.email_templates ?? {},
    categories: settings.categories ?? current?.categories ?? [],
    feature_flags: settings.feature_flags ?? current?.feature_flags ?? {},
    updated_at: new Date().toISOString(),
  };
  await getDocClient().send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return updated;
}
