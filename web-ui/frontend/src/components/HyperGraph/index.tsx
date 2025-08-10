import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Spin, message } from 'antd';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

const colors = [
    '#F6BD16',
    '#00C9C9',
    '#F08F56',
    '#D580FF',
    '#FF3D00',
    '#16f69c',
    '#004ac9',
    '#f056d1',
    '#a680ff',
    '#c8ff00',
];

const entityTypeColors = {
    'PERSON': '#00C9C9',
    'CONCEPT': '#a68fff',
    'ORGANIZATION': '#F08F56',
    'LOCATION': '#16f69c',
    'EVENT': '#004ac9',
    'PRODUCT': '#f056d1',
}

const HyperGraph = ({
    vertexId,
    database,
    height = '400px',
    width = '100%',
    showTooltip = true,
    containerStyle = {},
    graphId = 'hypergraph-viewer'
}) => {
    const [data, setData] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredHyperedgeKey, setHoveredHyperedgeKey] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string }>({
        visible: false,
        x: 0,
        y: 0,
        content: '',
    });

    // 获取vertex邻居数据
    const fetchVertexNeighbor = async (vId, db) => {
        if (!vId) {
            return;
        }

        setLoading(true);
        try {
            const url = db
                ? `${SERVER_URL}/db/vertices_neighbor/${encodeURIComponent(vId)}?database=${encodeURIComponent(db)}`
                : `${SERVER_URL}/db/vertices_neighbor/${encodeURIComponent(vId)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API failed: ${response.status}`);
            }
            const neighborData = await response.json();
            setData(neighborData);
        } catch (error) {
            console.error('Failed to fetch vertex neighbor:', error);
            message.error(`获取图数据失败: ${error.message}`);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (vertexId) {
            fetchVertexNeighbor(vertexId, database);
        }
    }, [vertexId, database]);

    const colorByHyperedgeKey = useMemo(() => {
        if (!data) return {} as Record<string, string>;
        const result: Record<string, string> = {};
        const edgeKeys = Object.keys(data.edges || {});
        for (let i = 0; i < edgeKeys.length; i++) {
            result[edgeKeys[i]] = colors[i % colors.length];
        }
        return result;
    }, [data]);

    const buildHyperedgeTooltip = (key: string) => {
        if (!data) return '';
        const edge = data.edges?.[key] || {};
        const nodes = key.split('|#|');
        const title = edge.keywords ? String(edge.keywords) : `超边 (${nodes.length} 节点)`;
        const desc = edge.description ? String(edge.description).split('<SEP>').slice(0, 2).join('；') : '';
        return `
            <div>
                <div style="font-weight:600;margin-bottom:4px;">${title}</div>
                <div style="margin-bottom:4px;">成员: ${nodes.join('、')}</div>
                ${desc ? `<div>描述: ${desc}</div>` : ''}
            </div>
        `;
    };

    const options = useMemo(() => {
        const hyperData = {
            nodes: [],
            edges: [],
        };
        const plugins: any[] = [];

        if (data) {
            // 添加顶点
            for (const key in data.vertices) {
                hyperData.nodes.push({
                    id: key,
                    label: key,
                    ...data.vertices[key],
                });
            }

            // 创建样式函数
            const createStyle = (baseColor: string, isHover: boolean) => ({
                fill: baseColor,
                stroke: isHover ? '#000' : baseColor,
                lineWidth: isHover ? 3 : 1,
                fillOpacity: isHover ? 0.2 : 0.12,
                strokeOpacity: 1,
                // bubblesets配置
                maxRoutingIterations: 100,
                maxMarchingIterations: 20,
                pixelGroup: 4,
                edgeR0: 10,
                edgeR1: 60,
                nodeR0: 15,
                nodeR1: 50,
                morphBuffer: 10,
                threshold: 4,
                memberInfluenceFactor: 1,
                edgeInfluenceFactor: 4,
                nonMemberInfluenceFactor: -0.8,
                virtualEdges: true,
            });

            // 添加超边
            const edgeKeys = Object.keys(data.edges);
            for (let i = 0; i < edgeKeys.length; i++) {
                const key = edgeKeys[i];
                const nodes = key.split('|#|');
                const baseColor = colorByHyperedgeKey[key] || colors[i % colors.length];
                const isHover = hoveredHyperedgeKey === key;

                plugins.push({
                    key: `bubble-sets-${key}`,
                    type: 'bubble-sets',
                    members: nodes,
                    // labelText: edge.keywords || '',
                    ...createStyle(baseColor, isHover),
                });
            }

            // 添加tooltip插件（节点/边），超边使用自定义 tooltip
            if (showTooltip) {
                plugins.push({
                    type: 'tooltip',
                    getContent: (e, items) => {
                        let result = '';
                        items.forEach((item) => {
                            result += `<h4>${item.id}</h4>`;
                            if (item.entity_type) {
                                result += `<p><strong>类型:</strong> ${item.entity_type}</p>`;
                            }
                            if (item.description) {
                                result += `<p><strong>描述:</strong> ${item.description.split('<SEP>').slice(0, 2).join('；')}</p>`;
                            }
                        });
                        return result;
                    },
                });
            }
        }

        return {
            autoResize: true,
            data: hyperData,
            node: {
                palette: { field: 'cluster' },
                style: {
                    size: 25,
                    labelText: d => d.id,
                    fill: d => {
                        // 如果是当前查看的顶点，使用红色高亮
                        if (d.id === vertexId) {
                            return 'black';
                        }
                        // 根据entity_type设置不同颜色
                        if (d.entity_type) {
                            return entityTypeColors[d.entity_type] || '#8566CC' ;
                        }
                        // 默认颜色
                        return '#8566CC';
                    },
                }
            },
            edge: {
                style: {
                    size: 2,
                }
            },
            animate: false,
            behaviors: [
                'zoom-canvas',
                'drag-canvas',
                'drag-element',
            ],
            autoFit: 'center',
            layout: {
                type: 'force',
                clustering: true,
                preventOverlap: true,
                nodeClusterBy: 'entity_type',
                gravity: 20,
                linkDistance: 150,
            },
            plugins,
        };
    }, [data, vertexId, showTooltip, hoveredHyperedgeKey, colorByHyperedgeKey]);

    useEffect(() => {
        const graph = (graphRef.current as any)?.graph;
        if (!graph || !data) return;

        const findBubbleKeyFromShape = (shape: any): string | null => {
            let current = shape;
            for (let i = 0; i < 5 && current; i++) {
                const name = current?.cfg?.name || '';
                const id = current?.cfg?.id || '';
                const idOrName = `${name} ${id}`;
                const match = idOrName.match(/bubble-sets-([^\s]+)/);
                if (match && match[1]) return match[1];
                current = current?.getParent ? current.getParent() : null;
            }
            return null;
        };

        const approxDetectByBBox = (canvasX: number, canvasY: number): string | null => {
            if (!data) return null;
            const keys = Object.keys(data.edges || {});
            // convert to graph coords
            const pt = graph.getPointByCanvas?.(canvasX, canvasY) || { x: canvasX, y: canvasY };
            const gx = pt.x;
            const gy = pt.y;
            // margin based on bubble style
            const inflate = 60;
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const members: string[] = key.split('|#|');
                let minX = Number.POSITIVE_INFINITY;
                let minY = Number.POSITIVE_INFINITY;
                let maxX = Number.NEGATIVE_INFINITY;
                let maxY = Number.NEGATIVE_INFINITY;
                let valid = false;
                members.forEach((id) => {
                    const item = graph.findById(id);
                    const model = item?.getModel?.();
                    if (model && typeof model.x === 'number' && typeof model.y === 'number') {
                        valid = true;
                        minX = Math.min(minX, model.x);
                        minY = Math.min(minY, model.y);
                        maxX = Math.max(maxX, model.x);
                        maxY = Math.max(maxY, model.y);
                    }
                });
                if (!valid) continue;
                minX -= inflate; minY -= inflate; maxX += inflate; maxY += inflate;
                if (gx >= minX && gx <= maxX && gy >= minY && gy <= maxY) {
                    return key;
                }
            }
            return null;
        };

        const handleMouseMove = (e: any) => {
            // try exact shape detection
            const keyFromShape = findBubbleKeyFromShape(e?.target);
            let key: string | null = keyFromShape;

            // fallback approximate detection by bbox
            if (!key) {
                const pt = { x: e.canvasX, y: e.canvasY };
                key = approxDetectByBBox(pt.x, pt.y);
            }

            if (key) {
                if (hoveredHyperedgeKey !== key) setHoveredHyperedgeKey(key);
                if (showTooltip && containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip({
                        visible: true,
                        x: e.canvasX - rect.left,
                        y: e.canvasY - rect.top + 12,
                        content: buildHyperedgeTooltip(key),
                    });
                }
                return;
            }

            // 非超边区域，隐藏
            if (hoveredHyperedgeKey) setHoveredHyperedgeKey(null);
            if (tooltip.visible) setTooltip(t => ({ ...t, visible: false }));
        };

        const handleLeave = () => {
            if (hoveredHyperedgeKey) setHoveredHyperedgeKey(null);
            if (tooltip.visible) setTooltip(t => ({ ...t, visible: false }));
        };

        graph.on('mousemove', handleMouseMove);
        graph.on('canvas:mousemove', handleMouseMove);
        graph.on('canvas:mouseleave', handleLeave);

        return () => {
            graph.off('mousemove', handleMouseMove);
            graph.off('canvas:mousemove', handleMouseMove);
            graph.off('canvas:mouseleave', handleLeave);
        };
    }, [data, hoveredHyperedgeKey, showTooltip, tooltip.visible]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height,
                ...containerStyle
            }}>
                <Spin size="large" tip="加载超图数据中..." />
            </div>
        );
    }

    if (!data || !vertexId) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height,
                color: '#999',
                ...containerStyle
            }}>
                {!vertexId ? '请选择一个顶点' : '暂无图数据'}
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', height, width, ...containerStyle }}>
            <Graphin
                options={options}
                id={graphId}
                ref={graphRef}
                style={{ width: '100%', height: '100%' }}
                error={() => {
                    return <div>
                        <div>

                        </div>
                    </div>
                }}
            />
            {showTooltip && tooltip.visible && (
                <div
                    style={{
                        position: 'absolute',
                        left: tooltip.x,
                        top: tooltip.y,
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        maxWidth: 320,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    dangerouslySetInnerHTML={{ __html: tooltip.content }}
                />
            )}
        </div>
    );
};

export default HyperGraph;