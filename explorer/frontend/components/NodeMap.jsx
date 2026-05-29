import styles from '@/styles/components/NodeMap.module.scss';
import { formatNodeRoles } from '@/utils';
import { useTranslation } from 'next-i18next';
import { useEffect, useMemo, useRef } from 'react';

const getLocationKey = geoLocation => `${geoLocation.lat},${geoLocation.lon}`;

const escapeHtml = value => `${value ?? ''}`
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const createPopupHtml = (nodes, showRoles) => nodes.map(node => `
	<div class="${styles.popupNode}">
		<div class="${styles.popupName}">${escapeHtml(node.name)}</div>
		${showRoles ? `<div>${escapeHtml(formatNodeRoles(node.roles))}</div>` : ''}
		<div>${escapeHtml(node.endpoint)}</div>
	</div>
`).join('');

const createNodeGroups = nodes => Object.values(nodes.reduce((groups, node) => {
	const { geoLocation } = node;
	if ('number' !== typeof geoLocation?.lat || 'number' !== typeof geoLocation?.lon)
		return groups;

	const key = getLocationKey(geoLocation);
	if (!groups[key]) {
		groups[key] = {
			lat: geoLocation.lat,
			lon: geoLocation.lon,
			nodes: []
		};
	}

	groups[key].nodes.push(node);

	return groups;
}, {}));

const NodeMap = ({ nodes, showRoles = false }) => {
	const { t } = useTranslation();
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const layerRef = useRef(null);
	const nodeGroups = useMemo(() => createNodeGroups(nodes), [nodes]);

	useEffect(() => {
		let isMounted = true;

		const renderMap = async () => {
			if (!nodeGroups.length) {
				layerRef.current?.remove();
				layerRef.current = null;
				return;
			}

			if (!containerRef.current)
				return;

			const L = (await import('leaflet')).default;
			if (!isMounted)
				return;

			if (!mapRef.current) {
				mapRef.current = L.map(containerRef.current, {
					attributionControl: true,
					scrollWheelZoom: false,
					worldCopyJump: true
				}).setView([20, 0], 2);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
					maxZoom: 19
				}).addTo(mapRef.current);
			}

			layerRef.current?.remove();
			layerRef.current = L.layerGroup().addTo(mapRef.current);

			nodeGroups.forEach(group => {
				const count = group.nodes.length;
				const marker = count > 1
					? L.marker([group.lat, group.lon], {
						icon: L.divIcon({
							className: styles.clusterMarker,
							html: `${count}`,
							iconSize: [34, 34],
							iconAnchor: [17, 17]
						})
					})
					: L.circleMarker([group.lat, group.lon], {
						radius: 8,
						color: '#b429fa',
						weight: 3,
						fillColor: '#26c3f2',
						fillOpacity: 0.9
					});

				marker.bindPopup(createPopupHtml(group.nodes, showRoles));
				marker.addTo(layerRef.current);
			});

			const bounds = L.latLngBounds(nodeGroups.map(group => [group.lat, group.lon]));
			mapRef.current.fitBounds(bounds, {
				maxZoom: 4,
				padding: [36, 36]
			});
			setTimeout(() => mapRef.current?.invalidateSize(), 0);
		};

		renderMap();

		return () => {
			isMounted = false;
		};
	}, [nodeGroups, showRoles]);

	useEffect(() => () => {
		mapRef.current?.remove();
		mapRef.current = null;
	}, []);

	return (
		<div className={styles.nodeMap}>
			{nodeGroups.length
				? <div className={styles.map} ref={containerRef} data-testid="node-map" />
				: <div className={styles.emptyMap}>{t('message_noNodeLocations')}</div>}
		</div>
	);
};

export default NodeMap;
