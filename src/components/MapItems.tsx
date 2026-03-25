import { Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useEffect, useState } from 'react';

const itemTextStyle = new TextStyle({
  fontSize: 20,
  align: 'center',
});

const labelStyle = new TextStyle({
  fontSize: 7,
  fill: '#FFE08A',
  align: 'center',
  fontFamily: 'Arial',
  dropShadow: true,
  dropShadowColor: '#000000',
  dropShadowDistance: 1,
  dropShadowBlur: 2,
});

/** Render items on the game map as emoji sprites */
export function MapItems({
  worldId,
  tileDim,
}: {
  worldId: Id<'worlds'>;
  tileDim: number;
}) {
  // Skip query when worldId is not a valid Convex ID (e.g. empty string in demo mode)
  const hasValidWorldId = worldId && typeof worldId === 'string' && worldId.length > 5;
  const items = useQuery(api.items.listItems, hasValidWorldId ? { worldId } : 'skip');
  const [bounce, setBounce] = useState(0);

  // Simple bounce animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBounce((b) => (b + 1) % 60);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (!items) return null;

  const spawnedItems = items.filter((i) => i.state === 'spawned');

  return (
    <Container>
      {spawnedItems.map((item) => {
        const x = item.position.x * tileDim + tileDim / 2;
        const y = item.position.y * tileDim + tileDim / 2;
        // Gentle floating animation
        const floatY = Math.sin((bounce + item.position.x * 7) * 0.1) * 3;

        return (
          <Container key={item._id} x={x} y={y + floatY}>
            {/* Glow circle behind item */}
            <Text
              text="●"
              anchor={0.5}
              y={2}
              style={
                new TextStyle({
                  fontSize: 24,
                  fill: '#FFE08A',
                  // Pixi doesn't support CSS opacity on text, use alpha on container
                })
              }
              alpha={0.15 + Math.sin((bounce + item.position.x * 5) * 0.08) * 0.1}
            />
            {/* Item emoji */}
            <Text
              text={item.emoji}
              anchor={0.5}
              style={itemTextStyle}
            />
            {/* Item name label */}
            <Text
              text={item.name}
              anchor={{ x: 0.5, y: 0 }}
              y={12}
              style={labelStyle}
            />
          </Container>
        );
      })}
    </Container>
  );
}
