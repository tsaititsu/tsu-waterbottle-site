export const LINE_PAY_REVIEW_MODE = false

export const hiddenServices = {
  consultation: LINE_PAY_REVIEW_MODE,
  courses: LINE_PAY_REVIEW_MODE,
}

export function shouldHideConsultationServices() {
  return hiddenServices.consultation
}

export function shouldHideCoursesServices() {
  return hiddenServices.courses
}
