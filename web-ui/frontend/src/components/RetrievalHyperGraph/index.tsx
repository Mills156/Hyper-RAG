import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Graphin } from '@antv/graphin';

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


//  colors 加深
const entityTypeColors = {
    'PERSON': '#00C9C9',
    'CONCEPT': '#a68fff',
    'ORGANIZATION': '#F08F56',
    'LOCATION': '#16f69c',
    'EVENT': '#004ac9',
    'PRODUCT': '#f056d1',
}

const RetrievalHyperGraph = ({
    entities = [],
    hyperedges = [],
    height = '300px',
    width = '100%',
    showTooltip = true,
    containerStyle = {},
    graphId = 'retrieval-hypergraph',
    mode = 'hyper' // 新增mode参数，默认为hyper模式
}) => {
    const edgesName = mode === 'hyper' ? '超边' : '边'
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredHyperedgeKey, setHoveredHyperedgeKey] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string }>({
        visible: false,
        x: 0,
        y: 0,
        content: '',
    });
    // 转换数据格式为HyperGraph组件需要的格式
    const convertedData = useMemo(() => {
        // 如果没有数据，返回空
        if (!entities.length && !hyperedges.length) {
            return null;
        }

        const vertices = {};
        const edges = {};

        // 处理实体数据
        entities.forEach(entity => {
            const entityName = String(entity.entity_name || entity.name || `Entity_${Math.random()}`);
            vertices[entityName] = {
                ...entity,
                entity_type: String(entity.entity_type || 'Unknown'),
                description: String(entity.description || ''),
                label: String(entity.entity_name || entity.name || ''),
            };
        });

        // 处理超边数据
        hyperedges.forEach((edge, index) => {
            // 构建超边的键名，使用|#|分隔实体
            let edgeKey;
            if (Array.isArray(edge.entity_set)) {
                edgeKey = edge.entity_set.map(e => String(e)).join('|#|');
            } else if (typeof edge.entity_set === 'string') {
                edgeKey = edge.entity_set;
            } else if (edge.id_set) {
                // 如果没有entity_set但有id_set，使用id_set
                edgeKey = Array.isArray(edge.id_set) ? edge.id_set.map(e => String(e)).join('|#|') : String(edge.id_set);
            } else {
                edgeKey = `edge_${index}`;
            }

            // 确保超边中的实体也在vertices中
            const entityNames = edgeKey.split('|#|');
            entityNames.forEach(entityName => {
                if (!vertices[entityName]) {
                    vertices[entityName] = {
                        entity_type: 'Unknown',
                        description: `Entity from hyperedge: ${entityName}`
                    };
                }
            });

            edges[edgeKey] = {
                keywords: String(edge.keywords || edge.description || ''),
                description: String(edge.description || ''),
                weight: edge.weight || 1,
                ...edge
            };
        });

        return { vertices, edges };
    }, [entities, hyperedges]);

    const colorsByKey = useMemo(() => {
        if (!convertedData) return {} as Record<string, string>;
        const m: Record<string, string> = {};
        const keys = Object.keys(convertedData.edges || {});
        for (let i = 0; i < keys.length; i++) {
            m[keys[i]] = colors[i % colors.length];
        }
        return m;
    }, [convertedData]);

    const buildHyperedgeTooltip = (key: string) => {
        if (!convertedData) return '';
        const edge = convertedData.edges?.[key] || {};
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

        if (convertedData) {
            // 添加顶点
            for (const key in convertedData.vertices) {
                hyperData.nodes.push({
                    ...convertedData.vertices[key],
                    id: key,
                    label: String(key), // 确保label是字符串
                });
            }

            if (mode === 'graph') {
                // graph模式：设置标准边格式，不使用plugins
                const edgeKeys = Object.keys(convertedData.edges);
                for (let i = 0; i < edgeKeys.length; i++) {
                    const key = edgeKeys[i];
                    const nodes = key.split('|#|');

                    // 为每对节点创建边
                    for (let j = 0; j < nodes.length; j++) {
                        for (let k = j + 1; k < nodes.length; k++) {
                            hyperData.edges.push({
                                source: nodes[j],
                                target: nodes[k],
                                ...convertedData.edges[key]
                            });
                        }
                    }
                }
            } else {
                // hyper模式：使用原有的bubble-sets插件
                // 创建样式函数
                const createStyle = (baseColor: string, isHover: boolean) => ({
                    fill: baseColor,
                    stroke: isHover ? '#000' : baseColor,
                    lineWidth: isHover ? 3 : 1,
                    fillOpacity: isHover ? 0.2 : 0.12,
                    strokeOpacity: 1,
                    labelFill: '#fff',
                    labelPadding: 2,
                    labelBackgroundFill: baseColor,
                    labelBackgroundRadius: 5,
                    labelPlacement: 'center',
                    labelAutoRotate: false,
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
                const edgeKeys = Object.keys(convertedData.edges);
                for (let i = 0; i < edgeKeys.length; i++) {
                    const key = edgeKeys[i];
                    const nodes = key.split('|#|');
                    const baseColor = colorsByKey[key] || colors[i % colors.length];
                    const isHover = hoveredHyperedgeKey === key;

                    plugins.push({
                        key: `bubble-sets-${key}`,
                        type: 'bubble-sets',
                        members: nodes,
                        // labelText: String(edge.keywords || ''), // 确保labelText是字符串
                        ...createStyle(baseColor, isHover),
                    });
                }
            }

            // 添加tooltip插件（节点/边），超边使用自定义 tooltip
            if (showTooltip) {
                plugins.push({
                    type: 'tooltip',
                    getContent: (e, items) => {
                        let result = '';
                        items.forEach((item) => {
                            result += `<h4>${String(item.id)}</h4>`;
                            if (item.entity_type) {
                                result += `<p><strong>类型:</strong> ${String(item.entity_type)}</p>`;
                            }
                            if (item.description) {
                                const desc = String(item.description);
                                result += `<p><strong>描述:</strong> ${desc.split('<SEP>').slice(0, 2).join('；')}</p>`;
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
                    size: mode === 'graph' ? 20 : 25,
                    labelText: d => d.id,
                    fill: d => {

                        // 根据entity_type设置不同颜色
                        if (d.entity_type) {
                            return entityTypeColors[d.entity_type] || '#8566CC';
                        }
                        // 默认颜色
                        return '#8566CC';
                    },
                },
            },
            edge: {
                style: {
                    stroke: '#a68fff', // 边的颜色
                    lineWidth: 3,
                }
            },
            animate: false,
            behaviors: [
                'zoom-canvas',
                'drag-canvas',
                'drag-element',
            ],
            autoFit: 'view',
            layout: {
                type: 'force-atlas2',
                // clustering: true,
                preventOverlap: true,
                // nodeClusterBy: 'entity_type',
                kr: mode === 'graph' ? 5 : 80,
                gravity: 20,
                linkDistance: 10,
            },
            plugins: mode === 'graph' ? (showTooltip ? plugins : []) : plugins,
        };
    }, [convertedData, showTooltip, mode, hoveredHyperedgeKey, colorsByKey]);

    useEffect(() => {
        if (mode !== 'hyper') return;
        const graph = (graphRef.current as any)?.graph;
        if (!graph || !convertedData) return;

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
            if (!convertedData) return null;
            const keys = Object.keys(convertedData.edges || {});
            const pt = graph.getPointByCanvas?.(canvasX, canvasY) || { x: canvasX, y: canvasY };
            const gx = pt.x;
            const gy = pt.y;
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
            const keyFromShape = findBubbleKeyFromShape(e?.target);
            let key: string | null = keyFromShape;
            if (!key) {
                key = approxDetectByBBox(e.canvasX, e.canvasY);
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
    }, [mode, convertedData, hoveredHyperedgeKey, showTooltip, tooltip.visible]);

    // 如果没有数据，不显示组件
    if (!convertedData || (!entities.length && !hyperedges.length)) {
        return null;
    }

    return (
        <div style={{ height, width, ...containerStyle }}>
            <div style={{
                marginBottom: '8px',
                fontSize: '14px',
                color: '#666',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>检索结果可视化 - {mode}</span>
                <span style={{ fontSize: '12px' }}>
                    {edgesName}: {hyperedges.length}
                </span>
            </div>
            <div ref={containerRef} style={{ position: 'relative', width: '100%', height: 'calc(100% - 30px)' }}>
                <Graphin
                    options={options}
                    id={graphId}
                    ref={graphRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px'
                    }}
                    error={() => {
                        return (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%',
                                color: '#999'
                            }}>
                                图表加载失败
                            </div>
                        );
                    }}
                />
                {mode === 'hyper' && showTooltip && tooltip.visible && (
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
                    />)
                }
            </div>
        </div>
    );
};

export default RetrievalHyperGraph;