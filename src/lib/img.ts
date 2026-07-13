/** Local image paths (downloaded into /public/img, B&W-treated at render). */
export const imgLook = (id: string) => `/img/looks/${id}.jpg`;
export const imgItem = (id: string) => `/img/catalog/${id}.jpg`;
export const imgPerson = (seed: string) => `/img/people/${seed}.jpg`;

/** Local video clips (cut from runway footage) + their poster frames. */
export const videoLook = (id: string) => `/video/${id}.mp4`;
export const videoPoster = (id: string) => `/video/${id}.jpg`;
