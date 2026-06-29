import { namespaceInfoDTO } from '../api/namespace-dtos';

// The Namespace object produced by namespaceFromDTO from the NIS namespace DTOs.
export const namespace = {
	id: namespaceInfoDTO.fqn,
	name: namespaceInfoDTO.fqn,
	height: namespaceInfoDTO.height,
	owner: namespaceInfoDTO.owner
};
