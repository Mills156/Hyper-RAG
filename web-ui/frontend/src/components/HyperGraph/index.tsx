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
    const [hoveredHyperedge, setHoveredHyperedge] = useState(null);
    const [hyperedgeTooltip, setHyperedgeTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
    const graphRef = useRef(null);

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

    const options = useMemo(() => {
        const hyperData = {
            nodes: [],
            edges: [],
        };
        const plugins = [];

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
            const createStyle = (baseColor, edgeKey) => {
                const isHovered = hoveredHyperedge === edgeKey;
                return {
                    fill: isHovered ? baseColor + 'CC' : baseColor + '33', // 更明显的透明度变化
                    stroke: isHovered ? baseColor : baseColor + 'AA',
                    lineWidth: isHovered ? 3 : 2,
                    opacity: isHovered ? 1 : 0.7,
                    cursor: 'pointer',
                    // 添加阴影效果
                    shadowColor: isHovered ? baseColor : 'transparent',
                    shadowBlur: isHovered ? 10 : 0,
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
                };
            };

            // 添加超边
            const edgeKeys = Object.keys(data.edges);
            for (let i = 0; i < edgeKeys.length; i++) {
                const key = edgeKeys[i];
                const edge = data.edges[key];
                const nodes = key.split('|#|');

                plugins.push({
                    key: `bubble-sets-${key}`,
                    type: 'bubble-sets',
                    members: nodes,
                    // 存储超边信息供后续使用
                    data: {
                        edgeKey: key,
                        ...edge
                    },
                    ...createStyle(colors[i % colors.length], key),
                });
            }

            // 添加tooltip插件
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
            // 添加事件监听
            onReady: (graph) => {
                graphRef.current = graph;

                // 监听canvas鼠标移动事件
                graph.on('canvas:mousemove', (e) => {
                    handleCanvasMouseMove(e);
                });

                graph.on('canvas:mouseleave', () => {
                    setHoveredHyperedge(null);
                    setHyperedgeTooltip({ visible: false, x: 0, y: 0, content: '' });
                });
            },
        };
    }, [data, vertexId, showTooltip, hoveredHyperedge]);

    // 处理画布鼠标移动事件
    const handleCanvasMouseMove = (e) => {
        if (!data || !graphRef.current) return;

        const point = { x: e.x, y: e.y };
        const edgeKeys = Object.keys(data.edges);
        
        // 检查每个超边的包围区域
        let foundHyperedge = null;
        
        for (const edgeKey of edgeKeys) {
            const nodes = edgeKey.split('|#|');
            const nodePositions = nodes.map(nodeId => {
                const node = graphRef.current.getNodeData(nodeId);
                if (node) {
                    return graphRef.current.getElementPosition(nodeId);
                }
                return null;
            }).filter(pos => pos !== null);

            // 简单的包围盒检测
            if (nodePositions.length >= 2) {
                const minX = Math.min(...nodePositions.map(p => p.x)) - 50;
                const maxX = Math.max(...nodePositions.map(p => p.x)) + 50;
                const minY = Math.min(...nodePositions.map(p => p.y)) - 50;
                const maxY = Math.max(...nodePositions.map(p => p.y)) + 50;

                if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
                    foundHyperedge = edgeKey;
                    break;
                }
            }
        }

        if (foundHyperedge !== hoveredHyperedge) {
            setHoveredHyperedge(foundHyperedge);
            
            if (foundHyperedge) {
                const edge = data.edges[foundHyperedge];
                const nodes = foundHyperedge.split('|#|');
                
                // 生成更详细的tooltip内容
                let nodeDetails = nodes.map(nodeId => {
                    const vertex = data.vertices[nodeId];
                    if (vertex) {
                        return `<li>${nodeId}${vertex.entity_type ? ` (${vertex.entity_type})` : ''}</li>`;
                    }
                    return `<li>${nodeId}</li>`;
                }).join('');

                setHyperedgeTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    content: `
                        <div style="padding: 12px; max-width: 350px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">超边信息</h4>
                            <div style="margin: 8px 0;">
                                <strong style="color: #ffa726;">包含节点 (${nodes.length}):</strong>
                                <ul style="margin: 4px 0 8px 20px; padding: 0; list-style: circle;">
                                    ${nodeDetails}
                                </ul>
                            </div>
                            ${edge.keywords ? `<p style="margin: 6px 0;"><strong style="color: #66bb6a;">关键词:</strong> ${edge.keywords}</p>` : ''}
                            ${edge.description ? `<p style="margin: 6px 0;"><strong style="color: #42a5f5;">描述:</strong> ${edge.description.substring(0, 100)}${edge.description.length > 100 ? '...' : ''}</p>` : ''}
                            ${edge.weight !== undefined ? `<p style="margin: 6px 0;"><strong style="color: #ab47bc;">权重:</strong> ${edge.weight}</p>` : ''}
                        </div>
                    `
                });
            } else {
                setHyperedgeTooltip({ visible: false, x: 0, y: 0, content: '' });
            }
        }
    };

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
        <>
            <div style={{ height, width, ...containerStyle }}>
                <Graphin
                    options={options}
                    id={graphId}
                    style={{ width: '100%', height: '100%' }}
                    error={() => {
                        return <div>
                            <div>

                            </div>
                        </div>
                    }}
                />
            </div>
            {/* 自定义超边tooltip */}
            {hyperedgeTooltip.visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: hyperedgeTooltip.x + 10,
                        top: hyperedgeTooltip.y - 10,
                        background: 'rgba(0, 0, 0, 0.9)',
                        color: 'white',
                        borderRadius: '8px',
                        padding: '4px',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        maxHeight: '300px',
                        overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: hyperedgeTooltip.content }}
                />
            )}
        </>
    );
};

export default HyperGraph;